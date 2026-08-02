import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import { formatCurrency, formatDate, monthName, computeMonthlyInflow, computeBucketMonthly, anonymizeMember } from '@/lib/utils';
import { bucketColor, bucketLabel } from '@/lib/buckets';
import { roleLabel } from '@/lib/permissions';
import { FileText, Heart, Coins, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BucketBars } from '@/components/dashboard/bucket-bars';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const userId = user.id;
  const serviceNumber = user.serviceNumber;

  // Active member count - read from DB, never hardcoded
  const activeMemberCount = await prisma.user.count({
    where: { isActive: true, role: 'MEMBER' },
  });

  // My contributions
  const myContributions = await prisma.contribution.findMany({
    where: { memberId: userId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  const myTotalContributions = myContributions.reduce((s, c) => s + c.amount, 0);

  // My claims
  const myClaims = await prisma.welfareClaim.findMany({
    where: { memberId: userId },
    orderBy: { createdAt: 'desc' },
  });
  const myPaidClaims = myClaims.filter((c) => c.status === 'PAID');
  const myTotalClaimed = myPaidClaims.reduce((s, c) => s + (c.amountApproved ?? 0), 0);

  // Buckets
  const buckets = await prisma.bucket.findMany({ orderBy: { code: 'asc' } });
  const totalKitty = buckets.reduce((s, b) => s + b.balance, 0);

  // This month collection progress
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const paidThisMonth = await prisma.contribution.count({
    where: { month: currentMonth, year: currentYear, member: { isActive: true, role: 'MEMBER' } },
  });

  // Recent activity (last 5 contributions, anonymized)
  const recentContributions = await prisma.contribution.findMany({
    take: 5,
    orderBy: { receivedAt: 'desc' },
    include: { member: { select: { serviceNumber: true } } },
  });

  // Next meeting
  const nextMeeting = await prisma.meeting.findFirst({
    where: { scheduledAt: { gte: now }, status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
  });

  // My contribution timeline (last 12 months)
  const timeline: { month: string; amount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const c = myContributions.find((x) => x.month === m && x.year === y);
    timeline.push({ month: `${monthName(m).slice(0, 3)} ${y.toString().slice(2)}`, amount: c?.amount ?? 0 });
  }

  const monthlyInflow = computeMonthlyInflow(activeMemberCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Welcome back, {user.fullName?.split(' ').slice(-1)[0]}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {serviceNumber} · {roleLabel(user.role)}
        </p>
      </div>

      {/* Hero cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>My total contributions</CardDescription>
            <CardTitle className="text-3xl font-bold font-heading text-navy-700">
              {formatCurrency(myTotalContributions)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {myContributions.length} monthly payment{myContributions.length === 1 ? '' : 's'} since joining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>My welfare claims</CardDescription>
            <CardTitle className="text-3xl font-bold font-heading text-gold-600">
              {formatCurrency(myTotalClaimed)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {myPaidClaims.length} approved · {myClaims.length - myPaidClaims.length} other
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total cooperative kitty</CardDescription>
            <CardTitle className="text-3xl font-bold font-heading text-primary">
              {formatCurrency(totalKitty)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {activeMemberCount} active members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
              <Link href="/claims/new">
                <Heart className="h-5 w-5" />
                <span className="text-xs">Submit claim</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
              <Link href="/statement">
                <FileText className="h-5 w-5" />
                <span className="text-xs">My statement</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
              <Link href="/contributions">
                <Coins className="h-5 w-5" />
                <span className="text-xs">My contributions</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
              <Link href="/meetings">
                <Calendar className="h-5 w-5" />
                <span className="text-xs">Meetings</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Group pulse */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This month</CardTitle>
            <CardDescription>
              {paidThisMonth} of {activeMemberCount} paid · {formatCurrency(monthlyInflow)} expected ({activeMemberCount} × {formatCurrency(config.monthlyContributionPerMember)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Collection progress</span>
              <span className="font-semibold">{Math.round((paidThisMonth / activeMemberCount) * 100)}%</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-navy-700 transition-all"
                style={{ width: `${(paidThisMonth / activeMemberCount) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next meeting</CardTitle>
          </CardHeader>
          <CardContent>
            {nextMeeting ? (
              <div>
                <div className="font-semibold">{nextMeeting.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(nextMeeting.scheduledAt)} · {nextMeeting.venue}
                </div>
                <Button asChild variant="link" className="px-0 mt-2">
                  <Link href="/meetings">
                    View details <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming meetings scheduled.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bucket breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket balances</CardTitle>
          <CardDescription>How the cooperative kitty is allocated</CardDescription>
        </CardHeader>
        <CardContent>
          <BucketBars buckets={buckets.map((b) => ({
            code: b.code,
            name: b.name,
            balance: b.balance,
            percentage: b.percentage,
          }))} />
        </CardContent>
      </Card>

      {/* My contribution timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My contributions · last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.every((t) => t.amount === 0) ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {timeline.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-navy-700 rounded-t"
                    style={{ height: `${t.amount > 0 ? (t.amount / config.monthlyContributionPerMember) * 100 : 4}%`, minHeight: '4px' }}
                    title={`${t.month}: ${formatCurrency(t.amount)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{t.month}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentContributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentContributions.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span className="text-muted-foreground">
                    {anonymizeMember(c.member.serviceNumber)} paid {formatCurrency(c.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(c.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
