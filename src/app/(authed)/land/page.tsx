import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate, toNumber, sumField } from '@/lib/utils';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'success' | 'gold'> = {
  SCOUTED: 'outline',
  SHORTLIST: 'secondary',
  DUE_DILIGENCE: 'warning',
  RECOMMENDED: 'gold',
  APPROVED: 'success',
  PURCHASED: 'success',
  SUBDIVIDED: 'success',
  REJECTED: 'destructive',
};

export default async function LandPage() {
  const user = await requireUser();

  const allowedRoles = ['CCD', 'LSC_MEMBER', 'CHAIRPERSON', 'FW'];
  if (!allowedRoles.includes(user.role)) {
    redirect('/dashboard');
  }

  const opportunities = await prisma.landOpportunity.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const purchases = await prisma.landPurchase.findMany({
    include: {
      opportunity: { select: { title: true, location: true } },
      plots: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Land Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Track land scout → purchase → allotment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Opportunities</CardDescription>
            <CardTitle className="text-2xl">{opportunities.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Purchased</CardDescription>
            <CardTitle className="text-2xl">{purchases.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total plots</CardDescription>
            <CardTitle className="text-2xl">{sumField(purchases, (p) => p.totalPlots)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities tracked yet.</p>
          ) : (
            <ul className="space-y-3">
              {opportunities.map((o) => (
                <li key={o.id} className="p-3 border rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{o.title}</div>
                      <div className="text-sm text-muted-foreground">{o.location}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {toNumber(o.sizeHectares)} ha · {toNumber(o.sizeSqm).toLocaleString()} sqm
                      </div>
                      {o.notes && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.notes}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={STATUS_COLORS[o.status] ?? 'outline'}>{o.status}</Badge>
                      <div className="text-sm font-semibold mt-1">{formatCurrency(toNumber(o.askingPrice))}</div>
                      {o.valuationPrice && (
                        <div className="text-xs text-muted-foreground">Val: {formatCurrency(toNumber(o.valuationPrice))}</div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No land purchased yet.</p>
          ) : (
            <ul className="space-y-3">
              {purchases.map((p) => (
                <li key={p.id} className="p-3 border rounded-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{p.opportunity.title}</div>
                      <div className="text-sm text-muted-foreground">{p.opportunity.location}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Purchased {formatDate(p.purchaseDate)} · {p.totalPlots} plots
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(toNumber(p.purchasePrice))}</div>
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
