import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canActAs, canViewExpenses, canRecordContributions } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AdminExpenseForm } from '@/components/expenses/admin-expense-form';
import { ExpenseVoidControl } from '@/components/expenses/expense-void-control';
import {
  ADMIN_EXPENSE_TYPE,
  ADMIN_EXPENSE_VOID_TYPE,
  summariseExpenses,
  monthPeriod,
  type ExpenseEntry,
} from '@/lib/admin-expense';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

/**
 * Administration expenses.
 *
 * The Admin & Audit bucket is 5% of every contribution. It is the money the
 * cooperative spends on itself. This page shows what has been spent, when, and
 * what is left in the bucket.
 *
 * Officers and the internal auditor only: these are the committee's books.
 */
export default async function ExpensesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!canActAs(user, canViewExpenses)) redirect('/dashboard');

  const sp = await searchParams;
  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1) || now.getMonth() + 1;
  const year = Number(sp.year ?? now.getFullYear()) || now.getFullYear();
  const period = monthPeriod(year, month);

  const adminBucket = await prisma.bucket.findUnique({ where: { code: 'ADMIN' } });
  const allBuckets = await prisma.bucket.findMany({ orderBy: { code: 'asc' } });
  const kitty = allBuckets
    .filter((b) => b.isActive)
    .reduce((s, b) => s + Number(b.balance), 0);
  const collected = await prisma.contribution.aggregate({ _sum: { amount: true } });
  const collectedTotal = Number(collected._sum.amount ?? 0);

  const transactions = adminBucket
    ? await prisma.bucketTransaction.findMany({
        where: {
          bucketId: adminBucket.id,
          type: { in: [ADMIN_EXPENSE_TYPE, ADMIN_EXPENSE_VOID_TYPE] },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const recorderIds = Array.from(
    new Set(transactions.map((t) => t.recordedById).filter((x): x is string => !!x)),
  );
  const recorders = await prisma.user.findMany({
    where: { id: { in: recorderIds } },
    select: { id: true, serviceNumber: true, fullName: true },
  });
  const recorderName = new Map(recorders.map((r) => [r.id, r.serviceNumber]));

  const voids = new Map<string, string>();
  for (const t of transactions) {
    if (t.type === ADMIN_EXPENSE_VOID_TYPE && t.referenceId) {
      voids.set(t.referenceId, t.note ?? '');
    }
  }

  const entries: ExpenseEntry[] = transactions
    .filter((t) => t.type === ADMIN_EXPENSE_TYPE)
    .map((t) => {
      const parts = (t.note ?? '').split(' | ');
      const payeePart = parts[2] ?? '';
      const receiptPart = parts[3] ?? '';
      return {
        id: t.id,
        amount: Math.abs(Number(t.amount)),
        spentOn: t.createdAt.toISOString().slice(0, 10),
        category: parts[0] ?? 'Other',
        description: parts[1] ?? (t.note ?? ''),
        payee: payeePart.startsWith('Paid to ') ? payeePart.slice(8) : null,
        receiptNumber: receiptPart.startsWith('Receipt ') ? receiptPart.slice(8) : null,
        recordedBy: t.recordedById ? recorderName.get(t.recordedById) ?? null : null,
        voided: voids.has(t.id),
        voidReason: voids.get(t.id) ?? null,
      };
    });

  const monthSummary = summariseExpenses(entries, period);
  const allTime = summariseExpenses(entries);
  const adminBalance = adminBucket ? Number(adminBucket.balance) : 0;
  const canRecord = canActAs(user, canRecordContributions);

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = [2026, 2027, 2028];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Administration expenses</h1>
        <p className="text-muted-foreground text-sm mt-1">
          What the cooperative has spent on running itself, out of the Admin &amp;
          Audit bucket.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admin &amp; Audit bucket left</CardDescription>
            <CardTitle className="text-2xl font-bold font-heading">
              {formatCurrency(adminBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Still available for administration.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Spent in {new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} {year}
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-heading">
              {formatCurrency(monthSummary.total)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {monthSummary.count} expense{monthSummary.count === 1 ? '' : 's'}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Spent to date</CardDescription>
            <CardTitle className="text-2xl font-bold font-heading">
              {formatCurrency(allTime.total)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {allTime.count} expense{allTime.count === 1 ? '' : 's'} since the bucket
              opened.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Effect on the kitty</CardDescription>
            <CardTitle className="text-2xl font-bold font-heading">
              {formatCurrency(kitty)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(collectedTotal)} collected from members, less what has
              been spent and lent out.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a period</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="month" className="text-xs text-muted-foreground">
                Month
              </label>
              <select
                id="month"
                name="month"
                defaultValue={month}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {new Date(Date.UTC(2026, m - 1, 1)).toLocaleString('en-GB', {
                      month: 'long',
                      timeZone: 'UTC',
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="year" className="text-xs text-muted-foreground">
                Year
              </label>
              <select
                id="year"
                name="year"
                defaultValue={year}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
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
        </CardContent>
      </Card>

      {canRecord && <AdminExpenseForm available={adminBalance} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expenses</CardTitle>
          <CardDescription>
            Everything recorded against the Admin &amp; Audit bucket, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been recorded against the Admin &amp; Audit bucket yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">What it was for</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Paid to</th>
                    <th className="py-2 pr-3 font-medium text-right">Amount</th>
                    <th className="py-2 pr-3 font-medium">Recorded by</th>
                    {canRecord && <th className="py-2 font-medium"></th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(new Date(e.spentOn + 'T00:00:00Z'))}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{e.category}</td>
                      <td className="py-2 pr-3">
                        {e.description}
                        {e.voided && (
                          <Badge variant="secondary" className="ml-2">
                            Withdrawn
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3">{e.payee ?? '-'}</td>
                      <td
                        className={
                          'py-2 pr-3 text-right font-medium ' +
                          (e.voided ? 'text-muted-foreground line-through' : '')
                        }
                      >
                        {formatCurrency(e.amount)}
                      </td>
                      <td className="py-2 pr-3">{e.recordedBy ?? '-'}</td>
                      {canRecord && (
                        <td className="py-2">
                          {!e.voided && <ExpenseVoidControl transactionId={e.id} />}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {monthSummary.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where the money went that month</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {Object.entries(monthSummary.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <li key={category} className="flex justify-between">
                    <span>{category}</span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
