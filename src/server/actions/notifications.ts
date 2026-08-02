'use server';

import { prisma } from '@/lib/db';

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
