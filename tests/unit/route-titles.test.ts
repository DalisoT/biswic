/**
 * Unit tests for the top bar's page-title resolution.
 *
 * The literacy hub used to show the raw lesson id in the top bar --
 * "415D3B94 0D36 4FD6 A766 558B73224339" -- because /learn had no entry in
 * the route table, so the fallback titleized the last path segment. A
 * record id is never a useful page title.
 */

import { describe, it, expect } from 'vitest';
import { deriveTitle } from '../../src/lib/route-titles';

const LESSON_UUID = '415d3b94-0d36-4fd6-a766-558b73224339';

describe('deriveTitle', () => {
  it('names the literacy hub', () => {
    expect(deriveTitle('/learn')).toBe('Literacy Hub');
  });

  it('names the progress page', () => {
    expect(deriveTitle('/learn/me')).toBe('My Learning');
  });

  it('keeps the hub name on a module page', () => {
    expect(deriveTitle('/learn/soft-loans-and-interest')).toBe('Literacy Hub');
  });

  it('keeps the hub name on a lesson page instead of showing the lesson id', () => {
    const title = deriveTitle(`/learn/soft-loans-and-interest/${LESSON_UUID}`);
    expect(title).toBe('Literacy Hub');
    expect(title).not.toContain('415D3B94');
  });

  it('keeps the hub name on the quiz pages', () => {
    expect(deriveTitle('/learn/soft-loans-and-interest/quiz')).toBe('Literacy Hub');
    expect(deriveTitle('/learn/soft-loans-and-interest/quiz/result')).toBe('Literacy Hub');
  });

  it('still resolves the exact route table first', () => {
    expect(deriveTitle('/dashboard')).toBe('Dashboard');
    expect(deriveTitle('/finance/contributions/import')).toBe('Import payroll');
    expect(deriveTitle('/members/new')).toBe('Add member');
  });

  it('falls back to the parent segment when the last one is a record id', () => {
    // No /learn prefix here, so the id fallback has to do the work.
    const title = deriveTitle(`/welfare/${LESSON_UUID}`);
    expect(title).toBe('Welfare');
    expect(title).not.toContain('415D3B94');
  });

  it('titleizes a plain dynamic segment', () => {
    expect(deriveTitle('/welfare/some-record')).toBe('Some Record');
  });

  it('has a title for the root path', () => {
    expect(deriveTitle('/')).toBe('BISWIC');
  });
});
