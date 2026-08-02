'use server';

import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { recordContribution, bulkRecordContributions } from '@/server/services/contribution-service';
import { canRecordContributions } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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
