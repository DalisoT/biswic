import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { canViewAuditLog } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  const user = await requireUser();

  if (!canViewAuditLog(user.role)) {
    redirect('/dashboard');
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { serviceNumber: true, fullName: true } } },
  });

  // Summary stats
  const last24h = logs.filter((l) => Date.now() - l.createdAt.getTime() < 24 * 60 * 60 * 1000).length;
  const failedLogins = logs.filter((l) => l.action === 'FAILED_LOGIN').length;
  const claimsSubmitted = logs.filter((l) => l.action === 'CLAIM_SUBMITTED').length;
  const claimsApproved = logs.filter((l) => l.action === 'CLAIM_APPROVED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Immutable record of all state-changing actions. Last 200 entries.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last 24 hours</CardDescription>
            <CardTitle className="text-2xl">{last24h}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed logins</CardDescription>
            <CardTitle className="text-2xl">{failedLogins}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Claims submitted</CardDescription>
            <CardTitle className="text-2xl">{claimsSubmitted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Claims approved</CardDescription>
            <CardTitle className="text-2xl">{claimsApproved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{formatDate(l.createdAt)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{l.user?.serviceNumber ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.action === 'FAILED_LOGIN' ? 'destructive' : 'outline'}>{l.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{l.entity}</div>
                      {l.entityId && <div className="text-xs text-muted-foreground">{l.entityId.slice(0, 12)}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">{l.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
