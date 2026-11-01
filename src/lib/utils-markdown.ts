/**
 * Tiny server-side markdown renderer for the literacy hub lessons.
 * ----------------------------------------------------------------------------
 * Why not a heavy library: lessons are short, trusted, authored by admins
 * via the seed script. We just need headings, paragraphs, lists, bold,
 * inline code, links and pipe tables. Avoiding marked / remark keeps the
 * bundle small.
 *
 * The output is plain semantic HTML with NO utility classes -- the styling
 * lives in the `.lesson-content` block in `src/app/globals.css`. Two reasons:
 *   1. `@tailwindcss/typography` is not installed, so the `prose` classes the
 *      learn pages used to carry did nothing at all.
 *   2. Tailwind only scans `src/app`, `src/components` and `src/pages`, so
 *      utility classes emitted from `src/lib` are never generated in the CSS.
 *
 * This is intentionally minimal -- for the /learn section only. If we ever
 * need full CommonMark, swap in `marked` and pass `gfm: true`.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only allow link targets we are comfortable putting in an href. Lesson
 * content is admin-authored and trusted, but a `javascript:` URL slipping
 * into a seed file would still be a script injection.
 */
function safeHref(url: string): string {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(u)) return u;
  return '#';
}

/**
 * Inline formatting: inline code, bold, italic and links.
 * Inline code is lifted out first so its contents can never be re-parsed as
 * bold/italic markup.
 */
function renderInline(src: string): string {
  const codeSpans: string[] = [];

  let r = escapeHtml(src);

  // Inline code -- park it behind a sentinel so the later passes skip it.
  r = r.replace(/`([^`]+)`/g, (_m, code: string) => {
    codeSpans.push(code);
    return `\u0000C${codeSpans.length - 1}\u0000`;
  });

  // Bold
  r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  r = r.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Links [text](url)
  r = r.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text: string, url: string) => `<a href="${safeHref(url)}">${text}</a>`
  );

  // Restore inline code
  r = r.replace(/\u0000C(\d+)\u0000/g, (_m, i: string) => `<code>${codeSpans[Number(i)]}</code>`);

  return r;
}

/** Split a pipe-table row into trimmed cells. Leading/trailing pipes optional. */
function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

/** A separator row looks like `| --- | :---: | ---: |`. */
function isTableSeparator(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** True when the line at `index` opens a pipe table (header row + separator). */
function startsTable(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  if (!line.includes('|')) return false;
  return isTableSeparator(lines[index + 1] ?? '');
}

function tableAlign(spec: string): 'left' | 'center' | 'right' {
  if (/^:-+:$/.test(spec)) return 'center';
  if (/^-+:$/.test(spec)) return 'right';
  return 'left';
}

/**
 * Render a pipe table. The wrapper is `.scroll-x` so a table wider than the
 * phone screen scrolls sideways instead of blowing out the layout.
 */
function renderTable(headerCells: string[], alignCells: string[], rows: string[][]): string {
  const aligns = headerCells.map((_, i) => tableAlign(alignCells[i] ?? ''));

  const head = headerCells
    .map(
      (c, i) =>
        `<th scope="col" style="text-align:${aligns[i]}">${renderInline(c)}</th>`
    )
    .join('');

  const body = rows
    .map((row) => {
      const cells = headerCells
        .map(
          (_, i) =>
            `<td style="text-align:${aligns[i]}">${renderInline(row[i] ?? '')}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<div class="scroll-x"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Lesson bodies begin with a markdown H1 that repeats the lesson title the
 * page header already shows. Fifteen of the seventeen seeded lessons repeat
 * it exactly and the other two repeat it near-verbatim, so the heading is
 * dropped outright rather than de-duplicated by fuzzy matching.
 */
export function stripLeadingHeading(src: string): string {
  if (!src) return '';
  const normalized = src.replace(/\r\n?/g, '\n');
  const match = /^#[ \t]+[^\n]*(?:\n+|$)/.exec(normalized);
  if (!match) return normalized;
  return normalized.slice(match[0].length);
}

/**
 * Convert a minimal markdown subset to HTML.
 * Supports: # h1, ## h2, ### h3, **bold**, *italic*, `code`, - lists,
 * 1. ordered lists, > blockquote, --- hr, paragraphs, [text](url) links,
 * pipe tables and line breaks.
 */
export function renderMarkdown(src: string): string {
  if (!src) return '';

  // Normalize line endings
  const lines = src.replace(/\r\n?/g, '\n').split('\n');

  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Skip blank lines (but they help separate blocks)
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      out.push('<hr />');
      i += 1;
      continue;
    }

    // Pipe table -- header row, separator row, then body rows
    if (startsTable(lines, i)) {
      const headerCells = splitTableRow(lines[i] ?? '');
      const alignCells = splitTableRow(lines[i + 1] ?? '');
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const l = lines[i] ?? '';
        if (l.trim() === '' || !l.includes('|')) break;
        rows.push(splitTableRow(l));
        i += 1;
      }
      out.push(renderTable(headerCells, alignCells, rows));
      continue;
    }

    // Headings
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      out.push(`<h3>${renderInline(h3[1] ?? '')}</h3>`);
      i += 1;
      continue;
    }
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      out.push(`<h2>${renderInline(h2[1] ?? '')}</h2>`);
      i += 1;
      continue;
    }
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      out.push(`<h1>${renderInline(h1[1] ?? '')}</h1>`);
      i += 1;
      continue;
    }

    // Blockquote (consecutive > lines)
    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s+/.test(lines[i] ?? '')) {
        quoteLines.push((lines[i] ?? '').replace(/^>\s+/, ''));
        i += 1;
      }
      out.push(`<blockquote>${renderInline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*]\s+/, ''));
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      out.push(`<ol>${items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    // Paragraph (consume until blank line or block element)
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|>\s|---+\s*$)/.test(lines[i] ?? '') &&
      !startsTable(lines, i)
    ) {
      para.push(lines[i] ?? '');
      i += 1;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}
