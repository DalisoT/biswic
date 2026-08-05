'use server';

import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { recordContribution, bulkRecordContributions } from '@/server/services/contribution-service';
import { canRecordContributions } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { config } from '@/lib/config';

const singleSchema = z.object({
  memberServiceNumber: z.string().min(1),
  amount: z.coerce.number().positive(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  paymentMethod: z.enum(['PAYROLL_DEDUCTION', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  receiptNumber: z.string().optional(),
  receivedAt: z.string().min(1),
});

export async function addContributionAction(formData: FormData) {
  const user = await requireUser();

  if (!canRecordContributions(user.role)) {
    return { error: 'You do not have permission to record contributions.' };
  }

  const parsed = singleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const { memberServiceNumber, ...rest } = parsed.data;

  const member = await prisma.user.findUnique({
    where: { serviceNumber: memberServiceNumber.toUpperCase() },
  });

  if (!member) {
    return { error: `Member with service number ${memberServiceNumber} not found.` };
  }

  try {
    await recordContribution({
      memberId: member.id,
      amount: rest.amount,
      month: rest.month,
      year: rest.year,
      paymentMethod: rest.paymentMethod,
      receiptNumber: rest.receiptNumber,
      receivedAt: new Date(rest.receivedAt),
      recordedById: user.id,
    });
  } catch (err: any) {
    return { error: err.message ?? 'Failed to record contribution.' };
  }

  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  return { success: true };
}

const bulkSchema = z.object({
  paymentMethod: z.enum(['PAYROLL_DEDUCTION', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  receivedAt: z.string().min(1),
  csv: z.string().min(1),
});

export async function bulkContributionsAction(formData: FormData) {
  const user = await requireUser();

  if (!canRecordContributions(user.role)) {
    return { error: 'You do not have permission to record contributions.' };
  }

  const parsed = bulkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', ') };
  }

  // Parse CSV: service_number,amount  (one per line)
  const lines = parsed.data.csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  const entries: Array<{ memberId: string; amount: number; month: number; year: number; receiptNumber?: string }> = [];
  const errors: string[] = [];

  for (const [idx, line] of lines.entries()) {
    const [serviceNumber, amountStr, monthStr, yearStr] = line.split(',').map((s) => s.trim());
    if (!serviceNumber || !amountStr) {
      errors.push(`Line ${idx + 1}: invalid format`);
      continue;
    }
    const member = await prisma.user.findUnique({
      where: { serviceNumber: serviceNumber.toUpperCase() },
    });
    if (!member) {
      errors.push(`Line ${idx + 1}: ${serviceNumber} not found`);
      continue;
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Line ${idx + 1}: invalid amount`);
      continue;
    }
    const month = monthStr ? parseInt(monthStr, 10) : new Date().getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    entries.push({ memberId: member.id, amount, month, year });
  }

  if (entries.length === 0) {
    return { error: 'No valid entries. ' + errors.join('; ') };
  }

  const result = await bulkRecordContributions(
    entries,
    user.id,
    parsed.data.paymentMethod,
    new Date(parsed.data.receivedAt)
  );

  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');

  return {
    success: result.success,
    failed: result.failed,
    total: result.total,
    errors: errors.slice(0, 10),
  };
}

// ----------------------------------------------------------------------------
// Improved monthly bulk import (payroll schedule friendly)
// ----------------------------------------------------------------------------
// Takes month+year+method+date ONCE at the top. CSV is just service_number
// (or service_number,amount) one per line. Default amount = monthly K100.
// Reports: imported count, already-paid SN, unknown SN, invalid rows.
// ----------------------------------------------------------------------------

const payrollBulkSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  paymentMethod: z.enum(['PAYROLL_DEDUCTION', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  receivedAt: z.string().min(1),
  csv: z.string().min(1),
});

export type PayrollBulkResult = {
  error?: string;
  total?: number;
  imported?: number;
  skipped?: number;
  unknown?: string[];
  invalid?: string[];
  alreadyPaid?: string[];
};

export async function bulkImportPayrollAction(
  formData: FormData,
): Promise<PayrollBulkResult> {
  const user = await requireUser();
  if (!canRecordContributions(user.role)) {
    return { error: 'Only the Treasurer, Deputy Treasurer, or Finance Warrant may import contributions.' };
  }

  const parsed = payrollBulkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { month, year, paymentMethod, receivedAt, csv } = parsed.data;

  // Parse: one entry per line. Format: service_number[,amount]
  const defaultAmount = config.monthlyContributionPerMember;
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const entries: { serviceNumber: string; amount: number }[] = [];
  const invalid: string[] = [];
  for (const [idx, line] of lines.entries()) {
    const parts = line.split(/[,\t]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    const serviceNumber = (parts[0] ?? '').toUpperCase();
    if (!serviceNumber) {
      invalid.push(`Line ${idx + 1}: missing service number`);
      continue;
    }
    const amount = parts[1] ? parseFloat(parts[1]) : defaultAmount;
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
      invalid.push(`Line ${idx + 1} (${serviceNumber}): invalid amount "${parts[1]}"`);
      continue;
    }
    entries.push({ serviceNumber, amount });
  }

  if (entries.length === 0) {
    return { error: 'No valid rows found.', invalid };
  }

  // Resolve service numbers -> user ids
  const users = await prisma.user.findMany({
    where: { serviceNumber: { in: entries.map((e) => e.serviceNumber) } },
    select: { id: true, serviceNumber: true },
  });
  const userBySN = new Map(users.map((u) => [u.serviceNumber, u.id]));
  const unknown = entries.filter((e) => !userBySN.has(e.serviceNumber)).map((e) => e.serviceNumber);

  // Find which of these already paid this month
  const alreadyPaidRows = await prisma.contribution.findMany({
    where: {
      month,
      year,
      memberId: { in: users.map((u) => u.id) },
    },
    select: { memberId: true },
  });
  const alreadyPaidIds = new Set(alreadyPaidRows.map((r) => r.memberId));
  const alreadyPaid = entries
    .filter((e) => userBySN.has(e.serviceNumber) && alreadyPaidIds.has(userBySN.get(e.serviceNumber)!))
    .map((e) => e.serviceNumber);

  // Build the to-import list
  const toImport = entries.filter(
    (e) => userBySN.has(e.serviceNumber) && !alreadyPaidIds.has(userBySN.get(e.serviceNumber)!),
  );

  if (toImport.length === 0) {
    revalidatePath('/finance');
    revalidatePath('/finance/contributions');
    revalidatePath('/contributions');
    revalidatePath('/dashboard');
    return {
      total: entries.length,
      imported: 0,
      skipped: alreadyPaid.length,
      unknown,
      invalid,
      alreadyPaid,
    };
  }

  // Record each contribution. Per-contribution transactions are pgbouncer-safe.
  const result = await bulkRecordContributions(
    toImport.map((e) => ({
      memberId: userBySN.get(e.serviceNumber)!,
      amount: e.amount,
      month,
      year,
    })),
    user.id,
    paymentMethod,
    new Date(receivedAt),
  );

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.CONTRIBUTION_RECORDED,
    entity: 'Contribution',
    notes: `Payroll bulk import ${year}-${String(month).padStart(2, '0')}: ${result.success} imported, ${alreadyPaid.length} already paid, ${unknown.length} unknown SN`,
  });

  revalidatePath('/finance');
  revalidatePath('/finance/contributions');
  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');

  return {
    total: entries.length,
    imported: result.success,
    skipped: alreadyPaid.length,
    unknown,
    invalid,
    alreadyPaid,
  };
}

export type MonthlyContributionStats = {
  month: number;
  year: number;
  expected: number;
  received: number;
  payerCount: number;
  totalActiveMembers: number;
  payerRate: number;
  topDefaulters: { serviceNumber: string; fullName: string; rank: string | null }[];
};

export async function getMonthlyContributionStats(
  month: number = new Date().getMonth() + 1,
  year: number = new Date().getFullYear(),
): Promise<MonthlyContributionStats> {
  const activeMembers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, serviceNumber: true, fullName: true, rank: true, joinedAt: true },
  });

  const startOfMonth = new Date(year, month - 1, 1);
  const eligibleMembers = activeMembers.filter((m) => new Date(m.joinedAt) <= startOfMonth);

  const contributions = await prisma.contribution.findMany({
    where: { month, year },
    select: { memberId: true, amount: true },
  });
  const paidIds = new Set(contributions.map((c) => c.memberId));

  const defaulters = eligibleMembers
    .filter((m) => !paidIds.has(m.id))
    .slice(0, 10)
    .map((m) => ({
      serviceNumber: m.serviceNumber,
      fullName: m.fullName,
      rank: m.rank,
    }));

  const received = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const expected = eligibleMembers.length * config.monthlyContributionPerMember;

  return {
    month,
    year,
    expected,
    received,
    payerCount: contributions.length,
    totalActiveMembers: eligibleMembers.length,
    payerRate: eligibleMembers.length > 0 ? contributions.length / eligibleMembers.length : 0,
    topDefaulters: defaulters,
  };
}
