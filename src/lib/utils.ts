/**
 * Utility helpers
 * ----------------------------------------------------------------------------
 * - Currency formatting (K1,234.00)
 * - Date formatting (day-month-year)
 * - Number formatting
 * - Phone formatting
 * - cn() for class merging
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { config } from './config';

/**
 * Coerce a Prisma Decimal (or anything else) to a plain JS number safely.
 * Prisma returns decimal.js Decimal objects for @db.Decimal columns; doing
 * `number + Decimal` directly produces unreliable results (the symptom
 * we just saw on the dashboard). Always go through this.
 */
export function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  // decimal.js Decimal or any object with toNumber / valueOf
  const obj = v as { toNumber?: () => number; valueOf?: () => number };
  if (typeof obj.toNumber === 'function') {
    const n = obj.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof obj.valueOf === 'function') {
    try {
      const n = Number(obj.valueOf());
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Sum a list of Prisma Decimal / number values. Use everywhere we used
 * to write `arr.reduce((s, x) => s + x.field, 0)`.
 */
export function sumField<T>(arr: T[], pick: (item: T) => unknown): number {
  let s = 0;
  for (const item of arr) s += toNumber(pick(item));
  return s;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency: K1,234.56 or K1,234 (no decimals for dashboards)
 */
export function formatCurrency(amount: number, withDecimals = false): string {
  const formatted = withDecimals
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(amount).toLocaleString('en-US');
  return `${config.currency}${formatted}`;
}

/**
 * Format compact currency: K1.2K, K1.5M
 */
export function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${config.currency}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${config.currency}${(amount / 1_000).toFixed(1)}K`;
  return `${config.currency}${Math.round(amount).toLocaleString()}`;
}

/**
 * Format date: "22 July 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format short date: "22 Jul"
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Format phone: "+260 97 123 4567"
 */
export function formatPhone(phone: string): string {
  // Strip non-digits except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Try to insert spaces
  if (cleaned.startsWith('+260') && cleaned.length === 13) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  return cleaned;
}

/**
 * Get active member count from DB
 * This is the canonical way to get N - never hardcode.
 */
export async function getActiveMemberCount(): Promise<number> {
  const { prisma } = await import('./db');
  return prisma.user.count({
    where: { isActive: true, role: 'MEMBER' },
  });
}

/**
 * Compute total monthly inflow from active member count
 */
export function computeMonthlyInflow(memberCount: number): number {
  return memberCount * config.monthlyContributionPerMember;
}

/**
 * Compute monthly inflow for a single bucket
 */
export function computeBucketMonthly(memberCount: number, percentage: number): number {
  return computeMonthlyInflow(memberCount) * (percentage / 100);
}

/**
 * Status badge variant
 */
export function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toUpperCase();
  if (['PAID', 'ACTIVE', 'APPROVED', 'DONE', 'YES', 'COMPLETED'].includes(s)) return 'default';
  if (['PENDING', 'OPEN', 'IN_PROGRESS', 'SCHEDULED', 'MAYBE'].includes(s)) return 'secondary';
  if (['REJECTED', 'CANCELLED', 'NO', 'FAILED', 'OVERDUE', 'INACTIVE'].includes(s)) return 'destructive';
  return 'outline';
}

/**
 * Mask a member's identity for activity feeds: "Member #23"
 */
export function anonymizeMember(serviceNumber: string | null, index?: number): string {
  if (index !== undefined) return `Member #${index}`;
  if (!serviceNumber) return 'Member';
  // Use last 3 digits
  const match = serviceNumber.match(/(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return `Member #${num}`;
  }
  return 'Member';
}

/**
 * Get month name
 */
export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
}

/**
 * Truncate text
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
