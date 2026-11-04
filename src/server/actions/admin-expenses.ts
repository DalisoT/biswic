'use server';

import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { canActAs, canRecordContributions } from '@/lib/permissions';
import {
  ADMIN_EXPENSE_TYPE,
  ADMIN_EXPENSE_VOID_TYPE,
  EXPENSE_CATEGORIES,
} from '@/lib/admin-expense';

/**
 * Record money spent on running the cooperative.
 *
 * The Admin & Audit bucket holds 5% of every contribution. It is the money the
 * committee spends on stationery, transport to meetings, printing, bank charges
 * and audit fees. Until this action existed, that money was simply part of the
 * kitty figure with no record of where it went, so the bucket balance and the
 * kitty both overstated what the cooperative actually holds.
 *
 * Recording an expense debits the ADMIN bucket and writes a ledger row, so:
 *   - the bucket balance falls by the amount spent
 *   - the cooperative kitty falls with it
 *   - the reconciliation card still shows drift of K0
 *
 * No schema change: the expense is a row in the bucket ledger.
 *
 * The note is written as pipe separated fields so the ledger still reads like
 * a ledger while the page can pick the fields apart again:
 *   category | description | Paid to <payee> | Receipt <number>
 */
export async function recordAdminExpenseAction(formData: FormData) {
  const user = await requireUser();

  if (!canActAs(user, canRecordContributions)) {
    return {
      error:
        'Only the Treasurer, the Deputy Treasurer or the Finance Warrant can ' +
        'record an administration expense.',
    };
  }

  const amount = Number(formData.get('amount'));
  const spentOn = String(formData.get('spentOn') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const payee = String(formData.get('payee') ?? '').trim();
  const receiptNumber = String(formData.get('receiptNumber') ?? '').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter the amount spent.' };
  }
  if (!spentOn) {
    return { error: 'Enter the date the money was spent.' };
  }
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return { error: 'Choose what the money was spent on.' };
  }
  if (description.length < 3) {
    return { error: 'Describe what the money was spent on.' };
  }

  const bucket = await prisma.bucket.findUnique({ where: { code: 'ADMIN' } });
  if (!bucket) {
    return { error: 'The Admin & Audit bucket is missing.' };
  }
  const available = Number(bucket.balance);
  if (available < amount) {
    return {
      error:
        'The Admin & Audit bucket holds K' +
        available.toFixed(2) +
        '. It cannot cover K' +
        amount.toFixed(2) +
        '.',
    };
  }

  const id = randomUUID();
  const clean = (s: string) => s.replace(/\s*\|\s*/g, ' / ');
  const note = [
    category,
    clean(description),
    payee ? 'Paid to ' + clean(payee) : '',
    receiptNumber ? 'Receipt ' + clean(receiptNumber) : '',
  ]
    .filter(Boolean)
    .join(' | ');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bucket.update({
        where: { id: bucket.id },
        data: { balance: { decrement: amount } },
      });
      await tx.bucketTransaction.create({
        data: {
          id,
          bucketId: bucket.id,
          amount: -amount,
          type: ADMIN_EXPENSE_TYPE,
          referenceType: 'AdminExpense',
          referenceId: id,
          note,
          recordedById: user.id,
          createdAt: new Date(spentOn),
        },
      });
    });
  } catch (err: any) {
    return { error: err?.message ?? 'Failed to record the expense.' };
  }

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.ADMIN_EXPENSE_RECORDED,
    entity: 'BucketTransaction',
    entityId: id,
    afterValue: { amount, category, description, spentOn, payee, receiptNumber },
    notes:
      'K' +
      amount.toFixed(2) +
      ' spent from the Admin & Audit bucket on ' +
      spentOn +
      ': ' +
      note,
  });

  revalidatePath('/expenses');
  revalidatePath('/finance/bucket-ledger');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/reports');
  return { success: true };
}

/**
 * Put a recorded expense back: the money returns to the Admin & Audit bucket
 * and the ledger shows the reversal. The original entry is never deleted, so
 * the committee can see that it was entered and then withdrawn.
 */
export async function voidAdminExpenseAction(formData: FormData) {
  const user = await requireUser();

  if (!canActAs(user, canRecordContributions)) {
    return {
      error:
        'Only the Treasurer, the Deputy Treasurer or the Finance Warrant can ' +
        'withdraw an expense.',
    };
  }

  const transactionId = String(formData.get('transactionId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!transactionId) {
    return { error: 'The expense to withdraw was not found.' };
  }
  if (reason.length < 5) {
    return { error: 'Say why the expense is being withdrawn.' };
  }

  const original = await prisma.bucketTransaction.findUnique({
    where: { id: transactionId },
  });
  if (!original || original.type !== ADMIN_EXPENSE_TYPE) {
    return { error: 'That is not an administration expense.' };
  }

  const alreadyVoided = await prisma.bucketTransaction.findFirst({
    where: { type: ADMIN_EXPENSE_VOID_TYPE, referenceId: transactionId },
  });
  if (alreadyVoided) {
    return { error: 'That expense has already been withdrawn.' };
  }

  const amount = Math.abs(Number(original.amount));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bucket.update({
        where: { id: original.bucketId },
        data: { balance: { increment: amount } },
      });
      await tx.bucketTransaction.create({
        data: {
          bucketId: original.bucketId,
          amount,
          type: ADMIN_EXPENSE_VOID_TYPE,
          referenceType: 'AdminExpense',
          referenceId: transactionId,
          note: 'Withdrawn: ' + reason + ' (was: ' + (original.note ?? '') + ')',
          recordedById: user.id,
          createdAt: original.createdAt,
        },
      });
    });
  } catch (err: any) {
    return { error: err?.message ?? 'Failed to withdraw the expense.' };
  }

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.ADMIN_EXPENSE_VOIDED,
    entity: 'BucketTransaction',
    entityId: transactionId,
    beforeValue: { amount: -amount, note: original.note },
    afterValue: { amount: amount, note: 'withdrawn' },
    notes:
      'K' +
      amount.toFixed(2) +
      ' returned to the Admin & Audit bucket. Reason: ' +
      reason,
  });

  revalidatePath('/expenses');
  revalidatePath('/finance/bucket-ledger');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/reports');
  return { success: true };
}
