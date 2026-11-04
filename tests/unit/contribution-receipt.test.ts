import { describe, it, expect } from 'vitest';
import { normaliseReceiptNumber } from '../../src/lib/contribution-receipt';

describe('normaliseReceiptNumber', () => {
  it('keeps a real receipt number', () => {
    expect(normaliseReceiptNumber('RCT-2026-08-104865')).toBe('RCT-2026-08-104865');
  });

  it('trims the padding off a receipt number', () => {
    expect(normaliseReceiptNumber('  RCT-2026-08-104865  ')).toBe('RCT-2026-08-104865');
  });

  it('turns an empty receipt into null', () => {
    expect(normaliseReceiptNumber('')).toBeNull();
  });

  it('turns a blank receipt into null', () => {
    expect(normaliseReceiptNumber('   ')).toBeNull();
  });

  it('turns a missing receipt into null', () => {
    expect(normaliseReceiptNumber(undefined)).toBeNull();
  });

  it('never returns an empty string, so the unique column is never violated', () => {
    for (const value of ['', '   ', undefined, null]) {
      expect(normaliseReceiptNumber(value)).not.toBe('');
    }
  });
});
