'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu as MenuIcon, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/permissions';
import { NAV_SECTIONS, navItemsForRole, MOBILE_TAB_HREFS, type NavItem } from '@/lib/nav';

/**
 * Phone navigation: a fixed 5-slot bottom tab bar plus a "More" sheet.
 *
 * Everything here is derived from `src/lib/nav.ts`. Do not add destinations in
 * this file -- Learn was unreachable on phones for weeks because this list was
 * a hand-maintained copy of the sidebar that quietly fell behind it.
 */
interface Props {
  role: string;
  unreadCount: number;
}

export function MobileNav({ role, unreadCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const allItems = navItemsForRole(role);
  const tabs: NavItem[] = MOBILE_TAB_HREFS.map((href) => {
    const found = allItems.find((i) => i.href === href);
    // Fallback keeps the bar renderable even if a tab is ever removed.
    return found ?? { label: href, href, icon: MenuIcon };
  });

  const go = (href: string) => router.push(href);

  return (
    <>
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-30 pb-safe shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="grid grid-cols-5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => go(item.href)}
                className={cn(
                  'relative flex flex-col items-center justify-center py-2 text-[11px] gap-1 min-h-[56px] transition-colors',
                  active
                    ? 'text-navy-700 font-semibold'
                    : 'text-muted-foreground active:bg-muted/60',
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-navy-700 rounded-full" />
                )}
              </button>
            );
          })}

          {/* More */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'relative flex flex-col items-center justify-center py-2 text-[11px] gap-1 min-h-[56px] transition-colors',
              moreOpen
                ? 'text-navy-700 font-semibold'
                : 'text-muted-foreground active:bg-muted/60',
            )}
            aria-label="More sections"
            aria-expanded={moreOpen}
          >
            <span className="relative">
              <MenuIcon className="h-5 w-5 shrink-0" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-destructive text-destructive-foreground text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            className="relative mt-auto bg-card rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom shadow-2xl"
          >
            {/* Drag affordance */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between p-4 border-t">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">All sections</h2>
                <p className="text-xs text-muted-foreground truncate">
                  Signed in as {roleLabel(role)}
                </p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-md active:bg-muted shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-2 py-2 pb-safe">
              {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter(
                  (i) => !i.roles || i.roles.includes(role),
                );
                if (visibleItems.length === 0) return null;
                return (
                  <div key={section.title} className="mb-2">
                    <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                    <ul>
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                'flex items-center gap-3 px-3 py-3 rounded-md active:bg-muted transition-colors min-h-[52px]',
                                active && 'bg-navy-50 text-navy-700 font-medium',
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {item.label}
                                </div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                v1.0 &middot; {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}