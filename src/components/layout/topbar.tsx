'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LogOut, Settings as SettingsIcon, User as UserIcon, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/server/actions/auth';
import { cn } from '@/lib/utils';

/**
 * Map a route segment to a human-readable page title.
 * The first match wins; fallback = titleized segment.
 */
const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/group': 'Group',
  '/contributions': 'Contributions',
  '/claims': 'Welfare Claims',
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
};

function deriveTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  // Try matching longest prefix
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const prefix = '/' + segments.slice(0, i).join('/');
    if (ROUTE_TITLES[prefix]) return ROUTE_TITLES[prefix];
  }
  // Fallback: titleize last segment
  const last = segments[segments.length - 1] ?? '';
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shouldShowBack(pathname: string): boolean {
  if (pathname === '/' || pathname === '/dashboard') return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length >= 2;
}

interface TopBarProps {
  fullName: string;
  serviceNumber: string;
  unreadCount: number;
}

export function TopBar({ fullName, serviceNumber, unreadCount }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const title = deriveTitle(pathname);
  const showBack = shouldShowBack(pathname);

  // Initials for avatar (e.g. "SGT TEMBO RICHARD" -> "ST")
  const initials = (() => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  })();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  const handleSignOut = () => {
    setMenuOpen(false);
    startTransition(async () => {
      await signOutAction();
      router.push('/login');
    });
  };

  // Close menu on route change
  useState(() => {
    if (typeof window === 'undefined') return;
    const handle = () => setMenuOpen(false);
    // no-op; close happens on click
  });

  return (
    <header
      className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b pt-safe"
    >
      <div className="flex items-center justify-between h-14 px-3 md:px-6 max-w-7xl">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Go back"
              className="-ml-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-base md:text-lg font-semibold font-heading truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-semibold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={pending}
              aria-label="Open user menu"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-navy-700 text-white text-xs font-semibold hover:bg-navy-800 disabled:opacity-50"
            >
              {initials}
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-md shadow-lg z-50">
                  <div className="px-4 py-3 border-b">
                    <div className="text-sm font-medium truncate">{fullName}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {serviceNumber}
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted"
                  >
                    <UserIcon className="h-4 w-4" />
                    My profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Settings
                  </Link>
                  <div className="border-t">
                    <button
                      onClick={handleSignOut}
                      disabled={pending}
                      className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted text-destructive disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {pending ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
