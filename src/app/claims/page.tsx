import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { canApproveWelfare, canViewAllMembers } from '@/lib/permissions';
import { config } from '@/lib/config';
import { Heart, Plus } from 'lucide-react';
import Link from 'next/link';
import { hasBothSignatures } from '@/lib/claim-rules';

export const dynamic = 'force-dynamic';

export default async function ClaimsPage() {
  const user = await requireUser();

  const role = user.role;
  const canApprove = canApproveWelfare(role);
  const canViewAll = canViewAllMembers(role);

  const claims = await prisma.welfareClaim.findMany({
    where: canViewAll ? {} : { memberId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { member: { select: { serviceNumber: true, fullName: true } } },
  });

  const pendingCount = claims.filter((c) => c.status === 'PENDING').length;
  const myApprovedCount = claims.filter((c) => c.status === 'APPROVED' || c.status === 'PAID').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Welfare Claims</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Funeral: {formatCurrency(config.welfareCaps.funeral.amountPerEvent)} max per event · Medical: {formatCurrency(config.welfareCaps.medical.amountPerEvent)} max per event
          </p>
        </div>
        <Button asChild>
          <Link href="/claims/new">
            <Plus className="h-4 w-4 mr-1" />
            Submit claim
          </Link>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{canViewAll ? 'All pending' : 'My pending'}</CardDescription>
            <CardTitle className="text-2xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{canViewAll ? 'All approved' : 'My approved'}</CardDescription>
            <CardTitle className="text-2xl">{myApprovedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total claims</CardDescription>
            <CardTitle className="text-2xl">{claims.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total approved amount</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(
                claims
                  .filter((c) => c.status === 'APPROVED' || c.status === 'PAID')
                  .reduce((s, c) => s + (c.amountApproved ?? 0), 0)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Claims list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{canViewAll ? 'All claims' : 'My claims'}</CardTitle>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No claims yet.</p>
              <Button asChild variant="link">
                <Link href="/claims/new">Submit your first claim</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  {canViewAll && <TableHead>Member</TableHead>}
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Event date</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signatures</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => {
                  const sigsOk = hasBothSignatures(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge variant={c.type === 'FUNERAL' ? 'secondary' : 'outline'}>
                          {c.type}
                        </Badge>
                      </TableCell>
                      {canViewAll && (
                        <TableCell>
                          <div className="font-medium">{c.member.serviceNumber}</div>
                          <div className="text-xs text-muted-foreground">{c.member.fullName}</div>
                        </TableCell>
                      )}
                      <TableCell>{c.beneficiary}</TableCell>
                      <TableCell className="text-xs">{formatDate(c.eventDate)}</TableCell>
                      <TableCell>{formatCurrency(c.amountRequested)}</TableCell>
                      <TableCell className="font-semibold">{c.amountApproved ? formatCurrency(c.amountApproved) : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          c.status === 'PAID' ? 'success' :
                          c.status === 'APPROVED' ? 'default' :
                          c.status === 'REJECTED' ? 'destructive' : 'warning'
                        }>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(c.amountRequested) > config.governance.twoSignatureThreshold ? (
                          <span className="text-xs">
                            {c.approvedByFwId ? '✓' : '✗'} FW · {c.approvedByChairId ? '✓' : '✗'} Chair
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/claims/${c.id}`}>View</Link>
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
