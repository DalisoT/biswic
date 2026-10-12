import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canPostMinutes } from '@/lib/permissions';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';
import { notifyAllMembers } from '@/server/actions/notifications';

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

  // Notify every active member EXCEPT the creator. (The old code only notified
  // plain MEMBERs, missing officers like the Treasurer, Secretary, etc. who
  // need the same heads-up.) Use the shared helper so we keep the recipient
  // list and error handling consistent.
  const recipientCount = await notifyAllMembers({
    type: 'MEETING_SCHEDULED',
    title: 'New meeting scheduled',
    body: `${meeting.title} on ${meeting.scheduledAt.toLocaleDateString()} at ${meeting.venue}.`,
    link: '/meetings',
    excludeUserId: user.id,
  }).catch((err) => {
    console.error('[notify] meeting-scheduled failed:', err);
    return 0;
  });

  return NextResponse.json({ success: true, meeting, recipientCount });
}
