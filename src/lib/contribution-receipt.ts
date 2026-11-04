/**
 * The receipt number on a contribution.
 *
 * Contribution.receiptNumber is unique in the database, so a blank receipt must
 * never reach it as an empty string: the first row with no receipt would take
 * the empty string, and every later row without a receipt would then fail with
 * "Unique constraint failed on the fields: (receiptNumber)". An empty receipt
 * is not a receipt, so it is stored as NULL, and Postgres allows many NULLs in
 * a unique column.
 */
export function normaliseReceiptNumber(
  value: string | null | undefined,
): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
