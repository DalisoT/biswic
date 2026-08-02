'use client';

import { formatCurrency } from '@/lib/utils';

interface Bucket {
  code: string;
  name: string;
  balance: number;
  percentage: number;
}

const COLORS: Record<string, string> = {
  LAND: '#0a3a5c',
  BUSINESS: '#b45309',
  FUNERAL: '#475569',
  MEDICAL: '#0891b2',
  ADMIN: '#64748b',
  EDUCATION: '#7c3aed',
};

export function BucketBars({ buckets }: { buckets: Bucket[] }) {
  const total = buckets.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-3">
      <div className="flex h-8 rounded-md overflow-hidden border">
        {buckets.map((b) => {
          const pct = total > 0 ? (b.balance / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={b.code}
              style={{ width: `${pct}%`, backgroundColor: COLORS[b.code] ?? '#64748b' }}
              className="flex items-center justify-center text-white text-xs font-medium"
              title={`${b.name}: ${formatCurrency(b.balance)}`}
            >
              {pct > 12 ? b.code : ''}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {buckets.map((b) => (
          <div key={b.code} className="border rounded-md p-3">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLORS[b.code] ?? '#64748b' }}
              />
              <span className="text-xs font-medium text-muted-foreground">{b.code}</span>
            </div>
            <div className="mt-1 font-semibold">{formatCurrency(b.balance)}</div>
            <div className="text-xs text-muted-foreground">{b.percentage * 100}% allocation</div>
          </div>
        ))}
      </div>
    </div>
  );
}
