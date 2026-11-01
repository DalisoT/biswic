/**
 * Unit tests for the navigation config.
 *
 * The nav is the single source of truth for the sidebar, the phone tab bar
 * and the command palette, so it is also the place where "who can see what"
 * is decided. The global admin override has to be honoured here as well as in
 * the permission layer: otherwise the owner is granted access to a screen by
 * the guard but is never shown the link that reaches it.
 *
 * The same class of bug hid /learn on phones -- a feature that existed and
 * worked, with no way to reach it.
 */

import { describe, it, expect } from 'vitest';
import { navItemsForRole, NAV_SECTIONS, MOBILE_TAB_HREFS } from '../../src/lib/nav';

const ALL_HREFS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.href),
);

describe('navItemsForRole', () => {
  it('gives an ordinary member only the ungated destinations', () => {
    const hrefs = navItemsForRole('MEMBER').map((i) => i.href);

    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/learn');
    expect(hrefs).toContain('/contributions');

    expect(hrefs).not.toContain('/audit');
    expect(hrefs).not.toContain('/finance');
    expect(hrefs).not.toContain('/members');
    expect(hrefs).not.toContain('/land');
  });

  it('gives the Treasurer the finance destinations but not the audit log', () => {
    const hrefs = navItemsForRole('TREASURER').map((i) => i.href);

    expect(hrefs).toContain('/finance');
    expect(hrefs).toContain('/finance/contributions');
    expect(hrefs).toContain('/finance/contributions-report');
    expect(hrefs).toContain('/finance/soft-loan-register');
    expect(hrefs).not.toContain('/audit');
  });

  it('gives the platform owner every destination when isAdmin is set', () => {
    const hrefs = navItemsForRole('CCD', true).map((i) => i.href).sort();

    // The owner is CCD by election, but isAdmin bypasses every role gate --
    // so the nav has to offer the Audit Log, Reports and Loan Register too.
    expect(hrefs).toContain('/audit');
    expect(hrefs).toContain('/reports');
    expect(hrefs).toContain('/finance/soft-loan-register');
    expect(hrefs).toEqual([...ALL_HREFS].sort());
  });

  it('gives the same list to an admin whose elected role is MEMBER', () => {
    expect(navItemsForRole('MEMBER', true).map((i) => i.href).sort()).toEqual(
      [...ALL_HREFS].sort(),
    );
  });

  it('does not widen the list for a non-admin officer', () => {
    // CCD is an officer but not an admin: the override must not leak.
    const hrefs = navItemsForRole('CCD').map((i) => i.href);
    expect(hrefs).not.toContain('/audit');
  });
});

describe('MOBILE_TAB_HREFS', () => {
  it('only contains destinations every member can reach', () => {
    const memberHrefs = navItemsForRole('MEMBER').map((i) => i.href);
    for (const href of MOBILE_TAB_HREFS) {
      expect(memberHrefs).toContain(href);
    }
  });
});
