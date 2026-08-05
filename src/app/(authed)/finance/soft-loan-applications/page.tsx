import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils';
import { canViewAllMembers } from '@/lib/permissions';
import { HandCoins, Inbox } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SoftLoanApplicationsPage() {
  const user = await requireUser();
  if (!canViewAllMembers(user.role) && user.role !== 'TREASURER' && user.role !== 'DEPUTY_TREASURER') {
    return <div className="text-center py-12"><p>You do not have permission to view this page.</p></div>;
  }

  const applications = await prisma.softLoan.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    orderBy: { appliedAt: 'desc' },
    include: { applicant: { select: { serviceNumber: true, fullName: true, rank: true, unit: true } } },
  });

  const subCommittee = await prisma.lendingSubCommittee.findFirst({
    where: { isActive: true },
    include: {
      chair: { select: { serviceNumber: true, fullName: true } },
      member1: { select: { serviceNumber: true, fullName: true } },
      member2: { select: { serviceNumber: true, fullName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Soft Loan Applications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pending and approved loans awaiting sub-committee action and disbursement.
        </p>
      </div>

      {subCommittee ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lending Sub-Committee</CardTitle>
            <CardDescription>Constitution Art. 5.5(d) - 2 of 3 required for approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Chair (FW)</div>
                <div className="font-medium">{subCommittee.chair.fullName}</div>
                <div className="text-xs text-muted-foreground">{subCommittee.chair.serviceNumber}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Member 1</div>
                <div className="font-medium">{subCommittee.member1.fullName}</div>
                <div className="text-xs text-muted-foreground">{subCommittee.member1.serviceNumber}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Member 2</div>
                <div className="font-medium">{subCommittee.member2.fullName}</div>
                <div className="text-xs text-muted-foreground">{subCommittee.member2.serviceNumber}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-800">No active Lending Sub-Committee</CardTitle>
            <CardDescription className="text-amber-700">
              The General Meeting must establish the Sub-Committee before any loans can be approved.
              (Constitution Art. 5.5(d))
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No pending or approved applications.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applied</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => {
                  const approvals = (a.chairApprovedAt ? 1 : 0) + (a.member1ApprovedAt ? 1 : 0) + (a.member2ApprovedAt ? 1 : 0);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{formatDate(a.appliedAt)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{a.applicant.serviceNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.applicant.fullName} · {a.applicant.rank ?? '—'} / {a.applicant.unit ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(toNumber(a.principal))}</TableCell>
                      <TableCell>{a.termMonths} mo</TableCell>
                      <TableCell className="max-w-xs truncate" title={a.purpose}>{a.purpose}</TableCell>
                      <TableCell>
                        <Badge variant={approvals >= 2 ? 'success' : 'warning'}>{approvals}/3</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'APPROVED' ? 'default' : 'warning'}>{a.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/finance/soft-loan-applications/${a.id}`}>Review</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
