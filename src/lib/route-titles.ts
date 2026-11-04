/**
 * Route -> human-readable page title.
 *
 * Lives outside the TopBar component so it can be unit tested: the TopBar is
 * a client component and pulling it into a node test environment drags in
 * next/navigation for no reason.
 *
 * The literacy hub needed an entry because `/learn/<slug>/<lessonId>` used to
 * be titled from the raw lesson UUID -- the top bar showed
 * "415D3B94 0D36 4FD6 A766 558B73224339" instead of a page name.
 */

/** Map a route segment to a human-readable page title. */
export const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/group': 'Group',
  '/contributions': 'Contributions',
  '/soft-loans': 'Soft Loans',
  '/soft-loans/apply': 'Apply for loan',
  '/members': 'Members',
  '/members/new': 'Add member',
  '/meetings': 'Meetings',
  '/documents': 'Documents',
  '/statement': 'Statement',
  '/land': 'Land Pipeline',
  '/businesses': 'Businesses',
  '/events': 'Events & Charity',
  '/audit': 'Audit Log',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/finance': 'Finance',
  '/finance/contributions': 'Contributions',
  '/finance/contributions/import': 'Import payroll',
  '/finance/soft-loan-applications': 'Loan applications',
  '/finance/soft-loan-register': 'Loan register',
  '/finance/soft-loan-defaults': 'Loan defaults',
  // Literacy hub. The prefix match in deriveTitle() covers the deeper
  // /learn/<slug>, /learn/<slug>/<lessonId> and quiz routes.
  '/learn': 'Literacy Hub',
  '/learn/me': 'My Learning',
};

/** A record id -- useless as a page title. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function titleize(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve a pathname to a page title.
 * Exact match first, then the longest matching prefix, then a fallback that
 * titleizes the last segment -- unless that segment is a record id, in which
 * case the nearest meaningful parent segment reads better than a string of
 * hex.
 */
export function deriveTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const prefix = '/' + segments.slice(0, i).join('/');
    if (ROUTE_TITLES[prefix]) return ROUTE_TITLES[prefix];
  }

  let last = segments[segments.length - 1] ?? '';
  if (UUID_RE.test(last) && segments.length > 1) {
    last = segments[segments.length - 2] ?? '';
  }
  if (!last) return 'BISWIC';
  return titleize(last);
}
