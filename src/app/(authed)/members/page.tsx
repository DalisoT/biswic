import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { roleLabel } from '@/lib/permissions';
import { formatDate, formatPhone } from '@/lib/utils';
import { isFoundingLockActive } from '@/lib/config';
import { UserPlus, Users, AlertTriangle, Lock } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const user = await requireUser();
  // The view is open to any logged-in member so they can see their peers.
  // (Add-member + edit actions are role-gated at the action layer.)
  const members = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { serviceNumber: 'asc' }],
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      rank: true,
      unit: true,
      role: true,
      isActive: true,
      isFoundingMember: true,
      phone: true,
      joinedAt: true,
    },
  });

  const lockActive = isFoundingLockActive();
  const totalMembers = members.filter((m) => m.role === 'MEMBER').length;
  const totalOfficers = members.filter((m) => m.role !== 'MEMBER').length;
  const activeCount = members.filter((m) => m.isActive).length;
  const foundingCount = members.filter((m) => m.isFoundingMember).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Users className="h-6 w-6" />
            Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalMembers} member{totalMembers !== 1 ? 's' : ''} · {totalOfficers} officer{totalOfficers !== 1 ? 's' : ''} · {activeCount} active
          </p>
        </div>
        <Button asChild>
          <Link href="/members/new">
            <UserPlus className="h-4 w-4 mr-1" />
            Add member
          </Link>
        </Button>
      </div>

      {lockActive && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-800 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Founding lock active
            </CardTitle>
            <CardDescription className="text-amber-700">
              Constitution Art. 2.2: no new members may be admitted before the Cooperative is formally
              registered. The Add Member flow is disabled until <code className="text-xs">config.governance.foundingLockReleased</code> is
              flipped to <code className="text-xs">true</code> (Secretary or Chair via env var). {foundingCount} founding
              members already on the register.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No members yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rank / Unit</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.serviceNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{m.fullName}</div>
                      {m.isFoundingMember && (
                        <div className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          Founding member
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{m.rank ?? '—'} / {m.unit ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === 'MEMBER' ? 'secondary' : 'default'}>
                        {roleLabel(m.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatPhone(m.phone)}</TableCell>
                    <TableCell className="text-xs">{formatDate(m.joinedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? 'success' : 'destructive'}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
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
