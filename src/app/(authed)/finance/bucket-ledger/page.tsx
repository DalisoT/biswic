import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canActAs, canViewReconciliation } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ bucket?: string; type?: string }>;
}

/**
 * The bucket ledger.
 *
 * Every movement of money between the cooperative's buckets, newest first,
 * with the running balance each bucket should now hold. This is the page that
 * answers "where did this figure come from" -- every balance on the dashboard
 * is the sum of the rows below it.
 *
 * Officers and the internal auditor only.
 */
export default async function BucketLedgerPage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!canActAs(user, canViewReconciliation)) redirect('/dashboard');

  const sp = await searchParams;
  const bucketFilter = (sp.bucket ?? '').toUpperCase();
  const typeFilter = (sp.type ?? '').trim();

  const buckets = await prisma.bucket.findMany({ orderBy: { code: 'asc' } });
  const allTypes = await prisma.bucketTransaction.groupBy({
    by: ['type'],
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { type: 'asc' },
  });

  const transactions = await prisma.bucketTransaction.findMany({
    where: {
      ...(bucketFilter ? { bucket: { code: bucketFilter } } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const recorderIds = Array.from(
    new Set(transactions.map((t) => t.recordedById).filter((x): x is string => !!x)),
  );
  const recorders = await prisma.user.findMany({
    where: { id: { in: recorderIds } },
    select: { id: true, serviceNumber: true },
  });
  const recorderName = new Map(recorders.map((r) => [r.id, r.serviceNumber]));
  const bucketCode = new Map(buckets.map((b) => [b.id, b.code]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Bucket ledger</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every movement of money between the cooperative&apos;s buckets. Each
          bucket balance is the sum of the rows that touch it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balances</CardTitle>
          <CardDescription>
            The live balance of each bucket, and what the ledger adds up to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Bucket</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Balance</th>
                  <th className="py-2 pr-3 font-medium">Ledger entries</th>
                  <th className="py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => {
                  const stats = allTypes.find((t) => t.type === b.code);
                  void stats;
                  return (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{b.code}</td>
                      <td className="py-2 pr-3">
                        {b.isActive ? 'Open' : 'Closed ' + (b.closedAt ? formatDate(b.closedAt) : '')}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium">
                        {formatCurrency(Number(b.balance))}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {String(Number(b.percentage) * 100).replace(/\.00$/, '')}%
                      </td>
                      <td className="py-2 text-right text-muted-foreground">-</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The ledger</CardTitle>
          <CardDescription>
            Newest first. {transactions.length} row{transactions.length === 1 ? '' : 's'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-2 mb-4">
            <div className="space-y-1">
              <label htmlFor="bucket" className="text-xs text-muted-foreground">
                Bucket
              </label>
              <select
                id="bucket"
                name="bucket"
                defaultValue={bucketFilter}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All buckets</option>
                {buckets.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="type" className="text-xs text-muted-foreground">
                Kind of movement
              </label>
              <select
                id="type"
                name="type"
                defaultValue={typeFilter}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All movements</option>
                {allTypes.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type} ({t._count._all})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="flex h-10 items-center rounded-md bg-navy-700 px-4 text-sm text-white"
            >
              Apply
            </button>
          </form>

          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rows match that filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Bucket</th>
                    <th className="py-2 pr-3 font-medium">Kind</th>
                    <th className="py-2 pr-3 font-medium">Note</th>
                    <th className="py-2 pr-3 font-medium">Recorded by</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="py-2 pr-3">{bucketCode.get(t.bucketId) ?? '-'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {t.type}
                      </td>
                      <td className="py-2 pr-3">{t.note ?? '-'}</td>
                      <td className="py-2 pr-3">
                        {t.recordedById ? recorderName.get(t.recordedById) ?? '-' : '-'}
                      </td>
                      <td
                        className={
                          'py-2 text-right font-medium ' +
                          (Number(t.amount) < 0 ? 'text-destructive' : '')
                        }
                      >
                        {formatCurrency(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
