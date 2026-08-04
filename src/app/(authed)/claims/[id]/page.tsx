import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { canApproveWelfare, canViewAllMembers } from '@/lib/permissions';
import { hasRequiredSignatures } from '@/lib/claim-rules';
import { config } from '@/lib/config';
import { ApprovalForm } from '@/components/claims/approval-form';
import { RejectForm } from '@/components/claims/reject-form';
import { MarkPaidButton } from '@/components/claims/mark-paid-button';
import { ArrowLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ClaimDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  const claim = await prisma.welfareClaim.findUnique({
    where: { id: params.id },
    include: {
      member: { select: { serviceNumber: true, fullName: true, rank: true, unit: true } },
      approvedByWelfareOfficer: { select: { serviceNumber: true, fullName: true } },
      approvedByFw: { select: { serviceNumber: true, fullName: true } },
      approvedByChair: { select: { serviceNumber: true, fullName: true } },
    },
  });

  if (!claim) notFound();

  const canView = canViewAllMembers(user.role) || claim.memberId === user.id;
  if (!canView) {
    return <div className="text-center py-12"><p>You do not have permission to view this claim.</p></div>;
  }

  // Constitution Art. 5.3: when a Welfare Officer is appointed, the 3-sig
  // rule applies. Otherwise the legacy 2-sig rule (FW + Chair) holds.
  const welfareOfficerAppointed =
    (await prisma.user.count({ where: { role: 'WELFARE_OFFICER', isActive: true } })) > 0;

  const canApprove = canApproveWelfare(user.role) && claim.status === 'PENDING';
  const needsTwoSigs = Number(claim.amountApproved ?? claim.amountRequested) > config.governance.twoSignatureThreshold;
  const sigsOk = hasRequiredSignatures(claim, welfareOfficerAppointed);

  const myApprovedThis =
    claim.approvedByWelfareOfficerId === user.id ||
    claim.approvedByFwId === user.id ||
    claim.approvedByChairId === user.id;

  const roleDisplay: Record<string, string> = {
    WELFARE_OFFICER: 'Welfare Claims Officer',
    FW: 'Finance Warrant',
    CHAIRPERSON: 'Chairperson',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/claims"><ArrowLeft className="h-4 w-4 mr-1" /> Back to claims</Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {claim.type === 'FUNERAL' ? 'Funeral' : 'Medical'} Claim
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submitted by {claim.member.serviceNumber} · {formatDate(claim.createdAt)}
          </p>
        </div>
        <Badge variant={
          claim.status === 'PAID' ? 'success' :
          claim.status === 'APPROVED' ? 'default' :
          claim.status === 'REJECTED' ? 'destructive' : 'warning'
        }>
          {claim.status}
        </Badge>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DetailRow label="Member" value={`${claim.member.fullName} (${claim.member.serviceNumber})`} />
          <DetailRow label="Rank / Unit" value={`${claim.member.rank ?? '—'} / ${claim.member.unit ?? '—'}`} />
          <DetailRow label="Type" value={claim.type} />
          <DetailRow label="Beneficiary" value={claim.beneficiary} />
          <DetailRow label="Event date" value={formatDate(claim.eventDate)} />
          <DetailRow label="Amount requested" value={formatCurrency(claim.amountRequested)} />
          {claim.amountApproved && (
            <DetailRow label="Amount approved" value={formatCurrency(claim.amountApproved)} />
          )}
          <DetailRow label="Description" value={claim.description ?? '—'} />
          {claim.supportingDocUrl && (
            <DetailRow
              label="Supporting document"
              value={<a href={claim.supportingDocUrl} className="text-navy-700 hover:underline" target="_blank" rel="noopener">{claim.supportingDocUrl}</a>}
            />
          )}
        </CardContent>
      </Card>

      {/* Signatures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {welfareOfficerAppointed ? 'Three-signature approval' : 'Two-signature approval'}
          </CardTitle>
          <CardDescription>
            {needsTwoSigs
              ? welfareOfficerAppointed
                ? `Constitution Art. 5.3: this claim requires Welfare Claims Officer + Finance Warrant + Chairperson signatures (amount > ${formatCurrency(config.governance.twoSignatureThreshold)}).`
                : `This claim requires both FW and Chairperson signatures (amount > ${formatCurrency(config.governance.twoSignatureThreshold)}).`
              : `This claim is below the two-signature threshold (${formatCurrency(config.governance.twoSignatureThreshold)}).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${welfareOfficerAppointed ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
            {welfareOfficerAppointed && (
              <div className="flex items-center gap-2 p-3 border rounded-md">
                {claim.approvedByWelfareOfficer ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Welfare Claims Officer</div>
                  <div className="text-sm font-medium">
                    {claim.approvedByWelfareOfficer?.fullName ?? 'Pending'}
                  </div>
                  {claim.approvedByWelfareOfficerAt && (
                    <div className="text-xs text-muted-foreground">{formatDate(claim.approvedByWelfareOfficerAt)}</div>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 border rounded-md">
              {claim.approvedByFw ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">Finance Warrant</div>
                <div className="text-sm font-medium">
                  {claim.approvedByFw?.fullName ?? 'Pending'}
                </div>
                {claim.approvedByFwAt && (
                  <div className="text-xs text-muted-foreground">{formatDate(claim.approvedByFwAt)}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-md">
              {claim.approvedByChair ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">Chairperson</div>
                <div className="text-sm font-medium">
                  {claim.approvedByChair?.fullName ?? 'Pending'}
                </div>
                {claim.approvedByChairAt && (
                  <div className="text-xs text-muted-foreground">{formatDate(claim.approvedByChairAt)}</div>
                )}
              </div>
            </div>
          </div>
          {claim.capOverrideNote && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <div className="font-semibold text-amber-800">Cap override applied</div>
              <div className="text-amber-700 mt-1">{claim.capOverrideNote}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval actions */}
      {canApprove && !myApprovedThis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approve as {roleDisplay[user.role] ?? user.role}</CardTitle>
            {needsTwoSigs && !sigsOk && (
              <CardDescription>
                {welfareOfficerAppointed
                  ? `This will be your signature. The other ${!claim.approvedByWelfareOfficerId ? 'Welfare Claims Officer, ' : ''}${!claim.approvedByFwId ? 'Finance Warrant, ' : ''}${!claim.approvedByChairId ? 'Chairperson' : ''} must also approve.`
                  : `This will be your signature. ${user.role === 'FW' ? 'Chair' : 'FW'} must also approve.`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ApprovalForm claimId={claim.id} requestedAmount={claim.amountRequested} />
          </CardContent>
        </Card>
      )}

      {canApprove && claim.status === 'PENDING' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reject claim</CardTitle>
            <CardDescription>A reason is required</CardDescription>
          </CardHeader>
          <CardContent>
            <RejectForm claimId={claim.id} />
          </CardContent>
        </Card>
      )}

      {canApprove && claim.status === 'APPROVED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mark as paid</CardTitle>
            <CardDescription>After the Treasurer has paid out the amount</CardDescription>
          </CardHeader>
          <CardContent>
            <MarkPaidButton claimId={claim.id} />
          </CardContent>
        </Card>
      )}

      {claim.status === 'REJECTED' && claim.rejectedReason && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">Rejection reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{claim.rejectedReason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
