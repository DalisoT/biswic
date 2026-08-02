import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canManageDocuments } from '@/lib/permissions';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

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

  return NextResponse.json({ success: true, doc });
}
