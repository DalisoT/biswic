/**
 * Unit tests for the daily provision rules.
 *
 * The provision is deterministic on purpose: the same date must always pick
 * the same quote, the same module and the same line, because members are
 * forwarded the same link. These tests pin that behaviour down, along with
 * the edge cases that would otherwise only show up as a blank card.
 */

import { describe, it, expect } from 'vitest';
import {
  buildProvisionBody,
  dayOrdinal,
  extractTeachingLines,
  isDateKey,
  pickQuote,
  provisionDateKey,
  selectProvision,
  trimTo,
} from '../../src/lib/daily-provision';
import { FINANCIAL_QUOTES } from '../../src/lib/financial-quotes';

const MODULES = [
  {
    title: 'Module A',
    slug: 'module-a',
    content: '',
    lessons: [
      {
        title: 'Lesson one',
        content: 'A lesson line long enough to stand on its own as the daily line.',
      },
    ],
  },
  {
    title: 'Module B',
    slug: 'module-b',
    content: '',
    lessons: [
      {
        title: 'Lesson two',
        content: 'Another lesson line long enough to stand on its own as the daily line.',
      },
    ],
  },
];

describe('provisionDateKey', () => {
  it('returns a plain YYYY-MM-DD key', () => {
    expect(provisionDateKey(new Date('2026-11-04T12:00:00Z'))).toBe('2026-11-04');
  });

  it('uses the cooperative timezone, not the server one', () => {
    // 23:30 UTC is already the next day in Lusaka (UTC+2).
    expect(provisionDateKey(new Date('2026-11-04T23:30:00Z'))).toBe('2026-11-05');
  });
});

describe('isDateKey', () => {
  it('accepts a real date', () => {
    expect(isDateKey('2026-11-04')).toBe(true);
  });

  it('rejects a date that does not exist', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-13-04')).toBe(false);
  });

  it('rejects anything that is not a plain date', () => {
    expect(isDateKey('not-a-date')).toBe(false);
    expect(isDateKey('')).toBe(false);
    expect(isDateKey('2026-11-04; DROP TABLE')).toBe(false);
  });
});

describe('dayOrdinal', () => {
  it('counts whole days and does not drift', () => {
    expect(dayOrdinal('2026-11-05') - dayOrdinal('2026-11-04')).toBe(1);
    expect(dayOrdinal('2026-11-04')).toBe(dayOrdinal('2026-11-04'));
  });
});

describe('pickQuote', () => {
  it('gives everyone the same quote on the same day', () => {
    expect(pickQuote('2026-11-04').text).toBe(pickQuote('2026-11-04').text);
  });

  it('moves on the next day', () => {
    expect(pickQuote('2026-11-04').text).not.toBe(pickQuote('2026-11-05').text);
  });

  it('never leaves the curated list', () => {
    let cursor = dayOrdinal('2026-01-01');
    for (let i = 0; i < 400; i++) {
      const date = new Date((cursor + i) * 86400000);
      const key = date.toISOString().slice(0, 10);
      const quote = pickQuote(key);
      expect(FINANCIAL_QUOTES.some((entry) => entry.text === quote.text)).toBe(true);
    }
  });
});

describe('the curated list', () => {
  it('has enough lines to rotate for more than a month', () => {
    expect(FINANCIAL_QUOTES.length).toBeGreaterThanOrEqual(30);
  });

  it('has no blank lines', () => {
    for (const quote of FINANCIAL_QUOTES) {
      expect(quote.text.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('extractTeachingLines', () => {
  it('skips headings, table rows and short fragments', () => {
    const markdown = [
      '# Heading',
      '',
      '| Line | What it is |',
      '| --- | --- |',
      'A paragraph long enough to stand on its own as a daily line.',
      '- A bullet that is also long enough to be a useful daily line.',
      'Too short.',
    ].join('\n');

    const lines = extractTeachingLines(markdown);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('A paragraph long enough');
    expect(lines[1]).toContain('A bullet that is also long enough');
  });

  it('strips emphasis and link syntax', () => {
    const markdown =
      '**Net pay** is the number you budget on, so read the [payslip guide](/learn) before you spend.';
    const lines = extractTeachingLines(markdown);
    expect(lines[0]).toBe(
      'Net pay is the number you budget on, so read the payslip guide before you spend.',
    );
  });

  it('strips a leading enumerator left behind by bold text', () => {
    const markdown =
      '**1. Pay yourself first**, on payday, before you spend anything at all.';
    const lines = extractTeachingLines(markdown);
    expect(lines[0]).toBe('Pay yourself first, on payday, before you spend anything at all.');
  });

  it('returns nothing for empty content', () => {
    expect(extractTeachingLines('')).toEqual([]);
  });
});

describe('trimTo', () => {
  it('cuts on a word boundary and marks the cut', () => {
    const out = trimTo('one two three four five six seven eight nine ten', 20);
    expect(out.endsWith('\u2026')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
  });

  it('leaves a short line alone', () => {
    expect(trimTo('short', 20)).toBe('short');
  });
});

describe('selectProvision', () => {
  it('returns a quote even when there are no modules', () => {
    const selection = selectProvision('2026-11-04', []);
    expect(selection.quote.text).toBeTruthy();
    expect(selection.moduleTitle).toBeNull();
    expect(selection.moduleLine).toBeNull();
  });

  it('pairs a module with a line taken from that module', () => {
    const selection = selectProvision('2026-11-04', MODULES);
    expect(selection.moduleTitle).toBeTruthy();
    expect(selection.moduleLine).toBeTruthy();
    const chosen = MODULES.find((mod) => mod.title === selection.moduleTitle);
    expect(chosen).toBeTruthy();
    expect(chosen!.lessons[0].content).toContain(selection.moduleLine!);
  });

  it('gives the same answer on the same day', () => {
    const first = selectProvision('2026-11-04', MODULES);
    const second = selectProvision('2026-11-04', MODULES);
    expect(first.moduleTitle).toBe(second.moduleTitle);
    expect(first.moduleLine).toBe(second.moduleLine);
  });
});

describe('buildProvisionBody', () => {
  it('carries the quote, the module line and the lesson', () => {
    const selection = selectProvision('2026-11-04', MODULES);
    const body = buildProvisionBody(selection, {
      lessonId: 'lesson-1',
      lessonTitle: 'Reading the payslip',
      moduleTitle: 'Salary',
      moduleSlug: 'salary',
    });
    expect(body).toContain(selection.quote.text);
    expect(body).toContain('Lesson reminder');
    expect(body).toContain('Reading the payslip');
  });

  it('says so when there is no lesson left', () => {
    const selection = selectProvision('2026-11-04', []);
    const body = buildProvisionBody(selection, null);
    expect(body).toContain('every lesson in the hub is done');
  });
});
