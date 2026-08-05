import { requireUser } from '@/lib/auth/require-user';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { canManageMembers } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditMemberForm } from '@/components/members/edit-member-form';
import { ArrowLeft, Info, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canManageMembers(user.role)) {
    redirect('/members');
  }

  const { id } = await params;
  const member = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      email: true,
      phone: true,
      nationalRegistrationNumber: true,
      rank: true,
      unit: true,
      role: true,
      isActive: true,
      isFoundingMember: true,
      foundingSignedAt: true,
      joinedAt: true,
      nextOfKin: true,
    },
  });
  if (!member) notFound();

  // Parse nextOfKin JSON
  let nextOfKin: { name?: string; relationship?: string; phone?: string } | null = null;
  if (member.nextOfKin && typeof member.nextOfKin === 'string') {
    try {
      nextOfKin = JSON.parse(member.nextOfKin);
    } catch {
      nextOfKin = null;
    }
  } else if (member.nextOfKin && typeof member.nextOfKin === 'object') {
    // Already-parsed object (from Prisma's JsonValue)
    nextOfKin = member.nextOfKin as { name?: string; relationship?: string; phone?: string };
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/members">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to members
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold font-heading">Edit member</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {member.serviceNumber} · {member.fullName} · {member.rank ?? 'no rank'}
          {member.isFoundingMember && <span className="text-amber-700"> · Founding member</span>}
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold">
            <Info className="h-4 w-4" />
            Constitution Art. 6.4
          </div>
          <p className="text-sm text-amber-700">
            Officer role changes made here should be <strong>ratified at the next General Meeting</strong>.
            The system logs every change (with before/after) so the GM can confirm or reject.
            Service numbers are <strong>immutable</strong> &mdash; they are real military IDs.
          </p>
          {member.serviceNumber.startsWith('CHAIR-') ||
          member.serviceNumber.startsWith('VICE-') ||
          member.serviceNumber.startsWith('FW-') ||
          member.serviceNumber.startsWith('SEC-') ||
          member.serviceNumber.startsWith('TR-') ||
          member.serviceNumber.startsWith('DTR-') ||
          member.serviceNumber.startsWith('TRUSTEE-') ? (
            <div className="flex items-start gap-2 text-amber-800 text-xs mt-2 pt-2 border-t border-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                This is a placeholder account (service number starts with a role code). Replace with a real service number from the nominal roll when promoting.
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <EditMemberForm
            member={{
              id: member.id,
              serviceNumber: member.serviceNumber,
              fullName: member.fullName,
              email: member.email,
              phone: member.phone,
              nrc: member.nationalRegistrationNumber,
              rank: member.rank,
              unit: member.unit,
              role: member.role,
              isActive: member.isActive,
              isFoundingMember: member.isFoundingMember,
              nextOfKin: nextOfKin,
            }}
            isSelf={member.id === user.id}
            isPlaceholder={/^(CHAIR|VICE|FW|SEC|TR|DTR|TRUSTEE|CCD)-/.test(member.serviceNumber)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
