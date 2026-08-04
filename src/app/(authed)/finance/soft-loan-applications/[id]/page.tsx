import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { canViewAllMembers } from '@/lib/permissions';
import { computeLoanSchedule } from '@/lib/soft-loan-math';
import { LoanDetailForReview } from '@/components/soft-loans/loan-detail-for-review';

export const dynamic = 'force-dynamic';

export default async function LoanReviewPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canViewAllMembers(user.role) && user.role !== 'TREASURER' && user.role !== 'DEPUTY_TREASURER') {
    return <div className="text-center py-12"><p>You do not have permission to view this page.</p></div>;
  }

  const loan = await prisma.softLoan.findUnique({
    where: { id: params.id },
    include: { applicant: { select: { id: true, serviceNumber: true, fullName: true, rank: true, unit: true } } },
  });
  if (!loan) notFound();

  const subCommittee = await prisma.lendingSubCommittee.findFirst({
    where: { isActive: true },
    select: { chairId: true, member1Id: true, member2Id: true },
  });

  const schedule = computeLoanSchedule(
    Number(loan.principal),
    loan.termMonths,
    Number(loan.interestRate),
  ).schedule;

  return (
    <LoanDetailForReview
      loan={{
        id: loan.id,
        status: loan.status,
        principal: Number(loan.principal),
        interestRate: Number(loan.interestRate),
        termMonths: loan.termMonths,
        monthlyPayment: Number(loan.monthlyPayment),
        totalRepayment: Number(loan.totalRepayment),
        balance: Number(loan.balance),
        purpose: loan.purpose,
        conflictDeclared: loan.conflictDeclared,
        appliedAt: loan.appliedAt,
        chairApprovedAt: loan.chairApprovedAt,
        member1ApprovedAt: loan.member1ApprovedAt,
        member2ApprovedAt: loan.member2ApprovedAt,
        disbursedAt: loan.disbursedAt,
        applicant: loan.applicant,
      }}
      currentUserId={user.id}
      committee={subCommittee}
      schedule={schedule}
    />
  );
}
