import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { config } from '@/lib/config';
import { formatCurrency, formatDate, computeMonthlyInflow, anonymizeMember, sumField, toNumber } from '@/lib/utils';
import { BucketBars } from '@/components/dashboard/bucket-bars';
import { Calendar, FileText } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function GroupDashboardPage() {
  const activeMemberCount = await prisma.user.count({
    where: { isActive: true, role: 'MEMBER' },
  });
  const buckets = await prisma.bucket.findMany({ orderBy: { code: 'asc' } });
  const totalKitty = sumField(buckets, (b) => b.balance);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const paidThisMonth = await prisma.contribution.count({
    where: { month: currentMonth, year: currentYear, member: { isActive: true, role: 'MEMBER' } },
  });

  const welfareClaimsYtd = await prisma.welfareClaim.aggregate({
    _sum: { amountApproved: true },
    _count: true,
    where: {
      status: { in: ['APPROVED', 'PAID'] },
      paidAt: {
        gte: new Date(currentYear, 0, 1),
      },
    },
  });

  const recentActivity = await prisma.contribution.findMany({
    take: 20,
    orderBy: { receivedAt: 'desc' },
    include: { member: { select: { serviceNumber: true } } },
  });

  const upcomingMeetings = await prisma.meeting.findMany({
    where: { scheduledAt: { gte: now }, status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
    take: 3,
  });

  const upcomingEvents = await prisma.event.findMany({
    where: { startAt: { gte: now } },
    orderBy: { startAt: 'asc' },
    take: 3,
  });

  const monthlyInflow = computeMonthlyInflow(activeMemberCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Cooperative Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {config.cooperativeName}
        </p>
      </div>

      {/* Hero numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Kitty</CardDescription>
            <CardTitle className="text-2xl font-bold text-navy-700">{formatCurrency(totalKitty)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Members</CardDescription>
            <CardTitle className="text-2xl font-bold">{activeMemberCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid this month</CardDescription>
            <CardTitle className="text-2xl font-bold">{paidThisMonth} / {activeMemberCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Welfare claims YTD</CardDescription>
            <CardTitle className="text-2xl font-bold text-gold-600">
              {formatCurrency(toNumber(welfareClaimsYtd._sum.amountApproved))}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bucket balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket balances</CardTitle>
          <CardDescription>
            Monthly inflow: {formatCurrency(monthlyInflow)} ({activeMemberCount} × {formatCurrency(config.monthlyContributionPerMember)})
          </CardDescription>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingMeetings.length === 0 && upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <>
                {upcomingMeetings.map((m) => (
                  <Link href="/meetings" key={m.id} className="flex items-start gap-3 hover:bg-muted p-2 rounded">
                    <Calendar className="h-4 w-4 mt-0.5 text-navy-700" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{m.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(m.scheduledAt)} · {m.venue}</div>
                    </div>
                    <Badge variant="outline">{m.type}</Badge>
                  </Link>
                ))}
                {upcomingEvents.map((e) => (
                  <Link href="/events" key={e.id} className="flex items-start gap-3 hover:bg-muted p-2 rounded">
                    <Calendar className="h-4 w-4 mt-0.5 text-gold-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(e.startAt)} · {e.venue}</div>
                    </div>
                    <Badge variant="gold">{e.type}</Badge>
                  </Link>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>
                <Link href="/documents" className="flex items-center gap-2 text-sm hover:underline">
                  <FileText className="h-4 w-4" /> Constitution & documents
                </Link>
              </li>
              <li>
                <Link href="/meetings" className="flex items-center gap-2 text-sm hover:underline">
                  <FileText className="h-4 w-4" /> Meeting minutes
                </Link>
              </li>
              <li>
                <Link href="/events" className="flex items-center gap-2 text-sm hover:underline">
                  <Calendar className="h-4 w-4" /> Events calendar
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Last 20 transactions, anonymized</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentActivity.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <span>{anonymizeMember(c.member.serviceNumber)} paid {formatCurrency(toNumber(c.amount))}</span>
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
