/**
 * Tiny server-side markdown renderer for the literacy hub lessons.
 * ----------------------------------------------------------------------------
 * Why not a heavy library: lessons are short, trusted, authored by admins
 * via the seed script. We just need headings, paragraphs, lists, bold,
 * inline code, and links. Avoiding marked / remark keeps the bundle small.
 *
 * This is intentionally minimal — for the /learn page only. If we ever
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
 * Convert a minimal markdown subset to HTML.
 * Supports: # h1, ## h2, ### h3, **bold**, *italic*, `code`, - lists,
 * 1. ordered lists, > blockquote, --- hr, paragraphs, [text](url) links,
 * and line breaks.
 */
export function renderMarkdown(src: string): string {
  if (!src) return '';

  // Normalize line endings
  const lines = src.replace(/\r\n?/g, '\n').split('\n');

  const out: string[] = [];
  let i = 0;

  const inline = (s: string): string => {
    let r = escapeHtml(s);
    // Inline code first to protect its content
    r = r.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-sm">$1</code>');
    // Bold
    r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    r = r.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // Links [text](url)
    r = r.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-emerald-700 underline hover:text-emerald-800">$1</a>'
    );
    return r;
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Skip blank lines (but they help separate blocks)
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      out.push('<hr class="my-6 border-border" />');
      i += 1;
      continue;
    }

    // Headings
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      out.push(`<h3 class="text-lg font-semibold mt-5 mb-2">${inline(h3[1] ?? '')}</h3>`);
      i += 1;
      continue;
    }
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      out.push(`<h2 class="text-xl font-semibold mt-6 mb-2">${inline(h2[1] ?? '')}</h2>`);
      i += 1;
      continue;
    }
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      out.push(`<h1 class="text-2xl font-bold mt-6 mb-3">${inline(h1[1] ?? '')}</h1>`);
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
      out.push(
        `<blockquote class="border-l-4 border-emerald-300 pl-4 my-3 text-muted-foreground italic">${inline(quoteLines.join(' '))}</blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*]\s+/, ''));
        i += 1;
      }
      out.push(
        `<ul class="list-disc pl-6 my-3 space-y-1">${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      out.push(
        `<ol class="list-decimal pl-6 my-3 space-y-1">${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`
      );
      continue;
    }

    // Paragraph (consume until blank line or block element)
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|>\s|---+\s*$)/.test(lines[i] ?? '')
    ) {
      para.push(lines[i] ?? '');
      i += 1;
    }
    out.push(`<p class="my-3 leading-relaxed">${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}
