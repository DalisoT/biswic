import { requireUser } from '@/lib/auth/require-user';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClearLockButton } from '@/components/admin/clear-lock-button';
import { roleLabel, hasAdminAccess } from '@/lib/permissions';
import { ShieldAlert, Clock, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

const OFFICER_ROLES = [
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'SECRETARY',
  'TREASURER',
  'DEPUTY_TREASURER',
  'FW',
  'CCD',
];

export default async function LockoutsPage() {
  const user = await requireUser();
  if (!user.isAdmin && !OFFICER_ROLES.includes(user.role)) {
    redirect('/dashboard');
  }

  const now = new Date();

  // Currently locked
  const locked = await prisma.user.findMany({
    where: { lockedUntil: { gt: now } },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      role: true,
      lockedUntil: true,
      failedLoginAttempts: true,
    },
    orderBy: { lockedUntil: 'asc' },
  });

  // Recently active failed attempts (not currently locked -- e.g. they had
  // a lockout that already expired, but the counter is still high). Useful
  // for spotting a member who's struggling to remember their password.
  const recent = await prisma.user.findMany({
    where: {
      failedLoginAttempts: { gte: 3 },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      role: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
    orderBy: { failedLoginAttempts: 'desc' },
    take: 25,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-heading">Locked accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Members locked out after too many failed sign-in attempts. Clear the
          lockout to let them try again immediately. Threshold: 10 attempts,
          15-minute lockout.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Currently locked ({locked.length})
          </CardTitle>
          <CardDescription>
            These members cannot sign in until the timer expires or you clear
            the lockout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locked.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members locked right now. </p>
          ) : (
            <ul className="divide-y">
              {locked.map((u) => {
                const remaining = u.lockedUntil
                  ? Math.max(0, Math.ceil((u.lockedUntil.getTime() - now.getTime()) / 60000))
                  : 0;
                return (
                  <li
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">
                          {u.serviceNumber}
                        </span>
                        <span className="font-medium truncate">{u.fullName}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {roleLabel(u.role)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {u.failedLoginAttempts} failed attempts · unlocks in
                        {' '}
                        {remaining} min
                        {u.lockedUntil && (
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            ({u.lockedUntil.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>
                    <ClearLockButton memberId={u.id} serviceNumber={u.serviceNumber} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-700" />
            Struggling members (3+ failed attempts, not currently locked)
          </CardTitle>
          <CardDescription>
            These accounts are not locked right now but the member has been
            mistyping their password. Worth a quick WhatsApp to confirm they
            know their password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent failed attempts. </p>
          ) : (
            <ul className="divide-y">
              {recent.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">
                        {u.serviceNumber}
                      </span>
                      <span className="font-medium truncate">{u.fullName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {roleLabel(u.role)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {u.failedLoginAttempts} failed attempts (no active lock)
                    </div>
                  </div>
                  <ClearLockButton memberId={u.id} serviceNumber={u.serviceNumber} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
