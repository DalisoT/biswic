import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canPostMinutes } from '@/lib/permissions';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(1),
  type: z.enum(['MONTHLY', 'QUARTERLY', 'AGM', 'SPECIAL', 'EMERGENCY']),
  scheduledAt: z.string().min(1),
  venue: z.string().min(1),
  agenda: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();

  if (!canPostMinutes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
  }

  const meeting = await prisma.meeting.create({
    data: {
      ...parsed.data,
      scheduledAt: new Date(parsed.data.scheduledAt),
      createdById: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.MEETING_SCHEDULED,
    entity: 'Meeting',
    entityId: meeting.id,
    afterValue: { title: meeting.title, scheduledAt: meeting.scheduledAt },
  });

  // Notify all members
  const allMembers = await prisma.user.findMany({
    where: { isActive: true, role: 'MEMBER' },
    select: { id: true },
  });
  for (const m of allMembers) {
    await prisma.notification.create({
      data: {
        userId: m.id,
        type: 'MEETING_SCHEDULED',
        title: 'New meeting scheduled',
        body: `${meeting.title} on ${meeting.scheduledAt.toLocaleDateString()}`,
        link: '/meetings',
      },
    });
  }

  return NextResponse.json({ success: true, meeting });
}
