/**
 * Unit tests for the literacy hub markdown renderer.
 *
 * Two things were broken before this was written:
 *
 *   1. Pipe tables rendered as raw pipe soup. The seeded lessons contain
 *      nine of them (tax bands, loan rates, contribution figures) and a
 *      member reading "PAYE bands | 2024 | 2025" on a phone was reading
 *      the source, not the lesson.
 *   2. Lesson bodies opened with a markdown H1 that repeated the title the
 *      page header already shows, so every lesson rendered its title twice.
 */

import { describe, it, expect } from 'vitest';
import { renderMarkdown, stripLeadingHeading } from '../../src/lib/utils-markdown';

describe('renderMarkdown -- pipe tables', () => {
  const table = [
    '| Tax band | Rate |',
    '| --- | ---: |',
    '| First K5,000 | 0% |',
    '| Next K10,000 | 15% |',
  ].join('\n');

  it('renders a pipe table as a real table element', () => {
    const html = renderMarkdown(table);
    expect(html).toContain('<table>');
    expect(html).toContain('</table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
  });

  it('does not leave the pipes in the output', () => {
    const html = renderMarkdown(table);
    expect(html).not.toContain('| Tax band');
    expect(html).not.toContain('| --- |');
  });

  it('emits a header cell per column and a row per body line', () => {
    const html = renderMarkdown(table);
    expect(html.match(/<th /g) ?? []).toHaveLength(2);
    expect(html.match(/<tr>/g) ?? []).toHaveLength(3); // header + 2 body rows
    expect(html).toContain('<th scope="col" style="text-align:left">Tax band</th>');
    expect(html).toContain('<th scope="col" style="text-align:right">Rate</th>');
    expect(html).toContain('<td style="text-align:left">First K5,000</td>');
  });

  it('reads alignment from the separator row', () => {
    const html = renderMarkdown([
      '| Left | Centre | Right |',
      '| :--- | :---: | ---: |',
      '| a | b | c |',
    ].join('\n'));
    expect(html).toContain('text-align:left');
    expect(html).toContain('text-align:center');
    expect(html).toContain('text-align:right');
  });

  it('accepts a table without leading or trailing pipes', () => {
    const html = renderMarkdown(['Band | Rate', '--- | ---', 'A | 1%'].join('\n'));
    expect(html).toContain('<table>');
    expect(html).toContain('Band</th>');
  });

  it('wraps the table so a wide table can scroll on a phone', () => {
    expect(renderMarkdown(table)).toContain('<div class="scroll-x">');
  });

  it('still recognises a table that follows a paragraph with no blank line', () => {
    const html = renderMarkdown(['Some intro text.', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'));
    expect(html).toContain('<table>');
    expect(html).toContain('<p>Some intro text.</p>');
  });

  it('leaves a line with a pipe but no separator row as a paragraph', () => {
    const html = renderMarkdown('a | b | c');
    expect(html).not.toContain('<table>');
    expect(html).toContain('<p>a | b | c</p>');
  });

  it('pads short body rows instead of dropping cells', () => {
    const html = renderMarkdown(['| A | B |', '| --- | --- |', '| 1 |'].join('\n'));
    expect(html).toContain('<td style="text-align:left">1</td>');
    expect(html).toContain('<td style="text-align:left"></td>');
  });
});

describe('stripLeadingHeading', () => {
  it('drops the leading H1 so the title is not rendered twice', () => {
    expect(stripLeadingHeading('# PAYE tax bands explained\n\nThe basics.')).toBe('The basics.');
  });

  it('drops an H1 that is the whole document', () => {
    expect(stripLeadingHeading('# Only a title')).toBe('');
  });

  it('leaves content without a leading heading untouched', () => {
    expect(stripLeadingHeading('Just a paragraph.')).toBe('Just a paragraph.');
  });

  it('keeps a heading that is not the first line', () => {
    const src = 'Intro line.\n\n## A section\n\nBody.';
    expect(stripLeadingHeading(src)).toBe(src);
  });

  it('handles CRLF input', () => {
    expect(stripLeadingHeading('# Title\r\n\r\nBody.')).toBe('Body.');
  });
});

describe('renderMarkdown -- output hygiene', () => {
  it('emits no utility classes -- the styles live in .lesson-content', () => {
    const html = renderMarkdown([
      '# Title',
      'A paragraph with **bold**, *italic* and `code`.',
      '- a list item',
      '> a quote',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n'));

    // The renderer used to emit Tailwind classes from src/lib, where
    // Tailwind never scans -- they were dead weight in the output.
    expect(html).not.toMatch(/class="(?!scroll-x)[^"]*text-/);
    expect(html).not.toContain('prose');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<blockquote>');
  });

  it('escapes html in the source', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuses a javascript: link target', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('keeps ordinary links', () => {
    const html = renderMarkdown('[coop](/learn)');
    expect(html).toContain('<a href="/learn">coop</a>');
  });

  it('does not treat markdown inside inline code as markup', () => {
    const html = renderMarkdown('use `**not bold**` here');
    expect(html).toContain('<code>**not bold**</code>');
    expect(html).not.toContain('<strong>');
  });
});
