/**
 * Soft Loan math (client-safe, shared between UI and service)
 * ----------------------------------------------------------------------------
 * Compute the equal-monthly-instalment schedule for a Soft Loan. Used by:
 *   - the apply form's live preview (client component)
 *   - the service's disbursement (server)
 *
 * The interest is calculated as simple interest on the outstanding balance
 * (annualRate / 12 * outstandingPrincipal), which matches how Zambian SACCOs
 * typically quote short-term member loans. The last month absorbs the
 * rounding remainder so the sum is exact to 2dp.
 */

export interface LoanScheduleEntry {
  monthIndex: number;
  principal: number;
  interest: number;
  isLast: boolean;
  payment: number;
}

export interface LoanSchedule {
  totalRepayment: number;
  monthlyPayment: number;
  totalInterest: number;
  schedule: LoanScheduleEntry[];
}

export function computeLoanSchedule(
  principal: number,
  termMonths: number,
  annualRate: number = 0.05,
): LoanSchedule {
  const termYears = termMonths / 12;
  const totalRepayment = principal * (1 + annualRate * termYears);

  const rawMonthly = totalRepayment / termMonths;
  const baseMonthly = Math.floor(rawMonthly * 100) / 100;
  const baseSum = baseMonthly * (termMonths - 1);
  const lastMonthly = Math.round((totalRepayment - baseSum) * 100) / 100;
  const totalInterest = totalRepayment - principal;
  const monthlyInterest = totalInterest / termMonths;
  const monthlyPrincipal = principal / termMonths;

  return {
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    monthlyPayment: Math.round(rawMonthly * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule: Array.from({ length: termMonths }, (_, i) => ({
      monthIndex: i + 1,
      principal: Math.round(monthlyPrincipal * 100) / 100,
      interest: Math.round(monthlyInterest * 100) / 100,
      isLast: i === termMonths - 1,
      payment: i === termMonths - 1 ? lastMonthly : baseMonthly,
    })),
  };
}
