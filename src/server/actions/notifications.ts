'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';

/**
 * Mark a single notification as read. The user can only mark their own.
 */
const idSchema = z.object({ id: z.string().uuid() });

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Invalid id' };
  await prisma.notification.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { read: true },
  });
  revalidatePath('/notifications');
  return { success: true };
}

/**
 * Mark all of the current user's notifications as read.
 */
export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath('/notifications');
  return { success: true };
}

/**
 * Internal helper. Mark all notifications for a user as read.
 * Used by both the user-facing action and by system code (e.g. when
 * a notification is "delivered" via realtime and dismissed automatically).
 */
export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/**
 * Internal helper: create a notification for a user.
 * Call from server actions (e.g. when a contribution is recorded, when a
 * claim is approved, when a meeting is scheduled, etc.).
 */
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}

/**
 * Internal helper: broadcast a notification to every active member.
 * Used for "meeting scheduled" and "event created" announcements.
 */
export async function notifyAllMembers(input: {
  type: string;
  title: string;
  body: string;
  link?: string;
  excludeUserId?: string;
}) {
  const members = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (members.length === 0) return 0;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    })),
  });
  return members.length;
}
