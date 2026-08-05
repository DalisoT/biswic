import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/search/members
 * Returns a compact list of active members for the command palette
 * search index. Capped at 200 most recently active. Only service
 * number, name, rank, id are returned.
 */
export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const members = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ serviceNumber: 'asc' }],
    take: 200,
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      rank: true,
    },
  });

  return NextResponse.json(members);
}
