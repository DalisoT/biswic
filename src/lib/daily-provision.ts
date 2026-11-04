/**
 * Daily provision - the rules for today's financial quote and lesson line.
 * ----------------------------------------------------------------------------
 * The provision is deterministic: the same date always selects the same
 * quote, the same module and the same line. That matters for three reasons:
 *
 *   1. Every member sees the same thing on the same day, so the quote that
 *      gets pasted into a WhatsApp group matches the one on the dashboard.
 *   2. Any day's content can be regenerated at any time, so there is no
 *      store of pre-written messages to keep in step with the date.
 *   3. Nothing here needs a cron or a scheduler.
 *
 * Dates are computed in the cooperative's own timezone (config.timezone), not
 * the server's, so the provision turns over at midnight in Lusaka.
 */

import { config } from './config';
import { FINANCIAL_QUOTES, type FinancialQuote } from './financial-quotes';

export const PROVISION_TIMEZONE = config.timezone;

/**
 * A calendar date in the cooperative's timezone, as YYYY-MM-DD.
 */
export function provisionDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROVISION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string): string => {
    const found = parts.find((p) => p.type === type);
    return found ? found.value : '';
  };
  return part('year') + '-' + part('month') + '-' + part('day');
}

/**
 * True for a real YYYY-MM-DD key. Anything else is rejected at the edge, so
 * a hand-edited query string can never reach the date maths.
 */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const asDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return (
    asDate.getUTCFullYear() === parts[0] &&
    asDate.getUTCMonth() === parts[1] - 1 &&
    asDate.getUTCDate() === parts[2]
  );
}

/**
 * Days since the epoch for a date key. This is the rotation index: it is
 * stable, evenly spaced and needs no state.
 */
export function dayOrdinal(key: string): number {
  const parts = key.split('-').map(Number);
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}

/**
 * The quote for a date. The same for everyone, every time.
 */
export function pickQuote(key: string, quotes: FinancialQuote[] = FINANCIAL_QUOTES): FinancialQuote {
  if (quotes.length === 0) throw new Error('No financial quotes are configured');
  const index = ((dayOrdinal(key) % quotes.length) + quotes.length) % quotes.length;
  return quotes[index];
}

/**
 * Lines of a lesson or module that read well standing on their own.
 *
 * Headings, table rows and code fences are skipped: a daily line has to make
 * sense with nothing above it to explain it. Bullets are kept, because in
 * these modules the bullets carry the rules.
 */
export function extractTeachingLines(markdown: string): string[] {
  const lines: string[] = [];
  const raw = markdown.split('\n');
  for (const entry of raw) {
    let line = entry.trim();
    if (!line) continue;
    if (/^(#{1,6}\s|\||>|\x60\x60\x60)/.test(line)) continue;
    line = line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
    const cleaned = line
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\x60([^\x60]*)\x60/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 30) continue;
    lines.push(trimTo(cleaned, 240));
  }
  return lines;
}

/**
 * Cut a line to a readable length, on a word boundary.
 */
export function trimTo(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const body = space > max * 0.6 ? cut.slice(0, space) : cut;
  return body + '\u2026';
}

export interface ProvisionModule {
  title: string;
  slug: string;
  content: string;
  lessons: { title: string; content: string }[];
}

/**
 * The text a module offers to the daily line: its own notes plus its
 * lessons. Some modules carry almost nothing on the module record itself, so
 * the lessons are what make a line available.
 */
export function moduleSourceText(module: ProvisionModule): string {
  const parts: string[] = [];
  if (module.content) parts.push(module.content);
  for (const lesson of module.lessons) parts.push(lesson.content);
  return parts.join('\n\n');
}

export interface ProvisionSelection {
  key: string;
  quote: FinancialQuote;
  moduleTitle: string | null;
  moduleLine: string | null;
}

/**
 * Today's provision: one quote and one line from the literacy hub.
 *
 * The module and the line are chosen with the same rotation index as the
 * quote, so the three move together and the pairing is different every day.
 */
export function selectProvision(key: string, modules: ProvisionModule[]): ProvisionSelection {
  const quote = pickQuote(key);
  if (modules.length === 0) {
    return { key: key, quote: quote, moduleTitle: null, moduleLine: null };
  }
  const ordinal = dayOrdinal(key);
  const moduleIndex = ((ordinal % modules.length) + modules.length) % modules.length;
  const chosen = modules[moduleIndex];
  const lines = extractTeachingLines(moduleSourceText(chosen));
  if (lines.length === 0) {
    return { key: key, quote: quote, moduleTitle: chosen.title, moduleLine: null };
  }
  const lineIndex = ((ordinal % lines.length) + lines.length) % lines.length;
  return { key: key, quote: quote, moduleTitle: chosen.title, moduleLine: lines[lineIndex] };
}

export interface ProvisionReminder {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  moduleSlug: string;
}

/**
 * The notification body for a member: the quote, the line from the hub, and
 * the one lesson worth finishing today.
 */
export function buildProvisionBody(
  selection: ProvisionSelection,
  reminder: ProvisionReminder | null,
): string {
  const parts: string[] = [];
  const quote =
    '"' + selection.quote.text + '"' + (selection.quote.author ? ' - ' + selection.quote.author : '');
  parts.push(quote);
  if (selection.moduleLine && selection.moduleTitle) {
    parts.push('From ' + selection.moduleTitle + ': ' + selection.moduleLine);
  }
  if (reminder) {
    parts.push(
      'Lesson reminder: "' + reminder.lessonTitle + '" (' + reminder.moduleTitle + '). Finish one lesson today.',
    );
  } else {
    parts.push('Lesson reminder: every lesson in the hub is done. Take the quizzes to close the modules.');
  }
  return parts.join('\n\n');
}
