import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, sumField, toNumber } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'success' | 'gold'> = {
  PLANNING: 'outline',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'destructive',
};

export default async function BusinessesPage() {
  const user = await requireUser();

  const allowedRoles = ['CCD', 'BUSINESS_MEMBER', 'CHAIRPERSON', 'FW'];
  if (!allowedRoles.includes(user.role)) {
    redirect('/dashboard');
  }

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const totalCapital = sumField(businesses, (b) => b.capitalInvested);
  const totalMonthlyProfit = sumField(businesses, (b) => b.currentMonthlyProfit);
  const activeCount = businesses.filter((b) => b.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Businesses</h1>
        <p className="text-sm text-muted-foreground mt-1">Collective investment portfolio</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active businesses</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total capital invested</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalCapital)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly profit</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {totalMonthlyProfit >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-rose-600" />}
              {formatCurrency(totalMonthlyProfit)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          {businesses.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No businesses yet.</p>
              <p className="text-xs text-muted-foreground mt-1">The cooperative will start businesses as the capital reserve grows.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {businesses.map((b) => (
                <li key={b.id} className="p-3 border rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-sm text-muted-foreground">{b.type}</div>
                      {b.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.description}</div>
                      )}
                      {b.startDate && (
                        <div className="text-xs text-muted-foreground mt-1">Started {formatDate(b.startDate)}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={STATUS_COLORS[b.status] ?? 'outline'}>{b.status}</Badge>
                      <div className="text-sm font-semibold mt-1">Capital: {formatCurrency(toNumber(b.capitalInvested))}</div>
                      <div className="text-xs text-muted-foreground">Monthly: {formatCurrency(toNumber(b.currentMonthlyProfit))}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
