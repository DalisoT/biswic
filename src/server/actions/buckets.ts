'use server';

import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { canActAs, canAdjustBuckets } from '@/lib/permissions';
import { planBucketAdjustment, type BucketMove } from '@/lib/bucket-adjustment';

/**
 * Move money between buckets.
 *
 * This is the control the cooperative did not have: before it, the only way
 * to fix a bucket was a hand-written SQL script, which left no audit trail and
 * could silently create or destroy money.
 *
 * The rules live in src/lib/bucket-adjustment.ts and are enforced here:
 * the moves must sum to zero (an adjustment moves money, it never creates
 * it), at least two buckets must be involved, no bucket may go below zero,
 * and a written reason is mandatory.
 *
 * Each affected bucket gets its own BucketTransaction of type ADJUSTMENT, so
 * the reconciliation card keeps showing drift of K0 afterwards.
 */
export async function adjustBucketsAction(formData: FormData) {
  const user = await requireUser();

  if (!canActAs(user, canAdjustBuckets)) {
    return {
      error:
        'Only an officer can adjust the buckets. The Treasurer, Secretary, ' +
        'Chairperson or the platform owner can do it.',
    };
  }

  const reason = String(formData.get('reason') ?? '').trim();
  if (reason.length < 10) {
    return {
      error:
        'Write a reason of at least 10 characters. The adjustment is kept in ' +
        'the audit log and the committee will read it.',
    };
  }

  if (formData.get('confirm') !== 'on') {
    return {
      error: 'Tick the confirmation box before applying the adjustment.',
    };
  }

  const codes = formData.getAll('moveCode').map((c) => String(c).trim().toUpperCase());
  const amounts = formData.getAll('moveAmount').map((a) => Number(a));
  const moves: BucketMove[] = [];
  for (let i = 0; i < codes.length; i++) {
    if (!codes[i]) continue;
    moves.push({ code: codes[i], amount: amounts[i] });
  }

  const buckets = await prisma.bucket.findMany();
  const result = planBucketAdjustment(
    buckets.map((b) => ({ code: b.code, balance: Number(b.balance) })),
    moves,
  );

  if ('problem' in result) {
    return { error: result.problem.message };
  }

  const plan = result.plan;
  const byCode = new Map(buckets.map((b) => [b.code, b]));

  try {
    await prisma.$transaction(async (tx) => {
      for (const m of plan.moves) {
        const bucket = byCode.get(m.code);
        if (!bucket) throw new Error('Unknown bucket ' + m.code + '.');
        await tx.bucket.update({
          where: { id: bucket.id },
          data: { balance: { increment: m.amount } },
        });
        await tx.bucketTransaction.create({
          data: {
            bucketId: bucket.id,
            amount: m.amount,
            type: 'ADJUSTMENT',
            referenceType: 'BucketAdjustment',
            referenceId: randomUUID(),
            note: reason,
            recordedById: user.id,
          },
        });
      }
    });
  } catch (err: any) {
    return { error: err?.message ?? 'Failed to apply the adjustment.' };
  }

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.BUCKET_ADJUSTED,
    entity: 'Bucket',
    beforeValue: plan.before,
    afterValue: plan.after,
    notes:
      'Bucket adjustment: ' +
      plan.moves
        .map((m) => m.code + ' ' + (m.amount > 0 ? '+' : '') + 'K' + m.amount.toFixed(2))
        .join(', ') +
      '. Reason: ' +
      reason,
  });

  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/reports');
  revalidatePath('/finance');
  revalidatePath('/finance/bucket-ledger');
  return { success: true };
}
