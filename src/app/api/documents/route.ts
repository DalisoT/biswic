import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canManageDocuments } from '@/lib/permissions';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';
import { notifyAllMembers, notifyAdmins } from '@/server/actions/notifications';

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  fileUrl: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.coerce.number().int().positive(),
  category: z.enum(['CONSTITUTION', 'MEETING_MINUTES', 'AUDIT_REPORT', 'LAND_DEED', 'BUSINESS_CONTRACT', 'ANNUAL_REPORT', 'POLICY', 'OTHER']),
  accessLevel: z.enum(['PUBLIC', 'MEMBER', 'OFFICER', 'EXECUTIVE', 'RESTRICTED']).default('MEMBER'),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();

  if (!canManageDocuments(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
  }

  const doc = await prisma.document.create({
    data: {
      ...parsed.data,
      uploadedById: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
    entity: 'Document',
    entityId: doc.id,
    afterValue: { title: doc.title, category: doc.category },
  });

  // Notify recipients based on access level. We use the accessLevel to decide
  // who "needs to know" — PUBLIC/MEMBER go to everyone, OFFICER/EXECUTIVE go
  // to the officer pool, RESTRICTED goes only to the Chair.
  const link = '/documents';
  const title = `New document: ${doc.title}`;
  const body = `${doc.category.replace(/_/g, ' ').toLowerCase()} uploaded (${doc.accessLevel.toLowerCase()} access).`;

  let recipientCount = 0;
  try {
    if (doc.accessLevel === 'RESTRICTED') {
      const chairs = await prisma.user.findMany({
        where: { isActive: true, OR: [{ isAdmin: true }, { role: 'CHAIRPERSON' }] },
        select: { id: true },
      });
      if (chairs.length > 0) {
        await prisma.notification.createMany({
          data: chairs.map((u) => ({
            userId: u.id,
            type: 'DOCUMENT_UPLOADED',
            title: `Restricted: ${doc.title}`,
            body,
            link,
          })),
        });
        recipientCount = chairs.length;
      }
    } else if (doc.accessLevel === 'OFFICER' || doc.accessLevel === 'EXECUTIVE') {
      recipientCount = await notifyAdmins({
        type: 'DOCUMENT_UPLOADED',
        title,
        body,
        link,
        excludeUserId: user.id,
      });
    } else {
      // PUBLIC or MEMBER — broadcast, skip the uploader
      recipientCount = await notifyAllMembers({
        type: 'DOCUMENT_UPLOADED',
        title,
        body,
        link,
        excludeUserId: user.id,
      });
    }
  } catch (err) {
    console.error('[notify] document-uploaded failed:', err);
  }

  return NextResponse.json({ success: true, doc, recipientCount });
}
