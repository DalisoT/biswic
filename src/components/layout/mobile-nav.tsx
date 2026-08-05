'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Coins,
  Heart,
  HandCoins,
  Bell,
  Menu as MenuIcon,
  X,
  ChevronRight,
  FileText,
  Calendar,
  Map,
  Briefcase,
  CalendarDays,
  BarChart3,
  Settings as SettingsIcon,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const TABS: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Pay', href: '/contributions', icon: Coins },
  { label: 'Claims', href: '/claims', icon: Heart },
  { label: 'Loans', href: '/soft-loans', icon: HandCoins },
  { label: 'More', href: '#more', icon: MenuIcon },
];

const MORE_SECTIONS: NavSection[] = [
  {
    title: 'You',
    items: [
      { label: 'My profile', href: '/settings', icon: SettingsIcon, description: 'Update your details' },
      { label: 'Notifications', href: '/notifications', icon: Bell, description: 'Recent activity' },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Contributions', href: '/contributions', icon: Coins, description: 'Your monthly payments' },
      { label: 'Soft Loans', href: '/soft-loans', icon: HandCoins, description: 'Apply, repay, status' },
      { label: 'Welfare Claims', href: '/claims', icon: Heart, description: 'Submit or track a claim' },
    ],
  },
  {
    title: 'Cooperative',
    items: [
      { label: 'Members', href: '/members', icon: Users, description: 'Roster + add members', roles: ['CHAIRPERSON', 'SECRETARY', 'FW', 'TREASURER', 'CCD', 'VICE_CHAIRPERSON', 'DEPUTY_TREASURER', 'TRUSTEE'] },
      { label: 'Finance', href: '/finance', icon: Wallet, description: 'Buckets, payroll, register', roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD', 'TRUSTEE', 'SECRETARY'] },
      { label: 'Meetings', href: '/meetings', icon: Calendar, description: 'Monthly + AGMs' },
      { label: 'Documents', href: '/documents', icon: FileText, description: 'Constitution + reports' },
      { label: 'Land Pipeline', href: '/land', icon: Map, description: 'Plots + scouts', roles: ['CCD', 'LSC_MEMBER', 'CHAIRPERSON', 'FW'] },
      { label: 'Businesses', href: '/businesses', icon: Briefcase, description: 'Investments + returns', roles: ['CCD', 'BUSINESS_MEMBER', 'CHAIRPERSON', 'FW'] },
      { label: 'Events & Charity', href: '/events', icon: CalendarDays },
      { label: 'Statement', href: '/statement', icon: BarChart3 },
      { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'] },
      { label: 'Audit Log', href: '/audit', icon: FileText, roles: ['FW', 'CHAIRPERSON', 'TRUSTEE', 'INTERNAL_AUDITOR'] },
    ],
  },
];

interface Props {
  role: string;
  unreadCount: number;
}

export function MobileNav({ role, unreadCount }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-30 pb-safe shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isMore = item.href === '#more';
            const active = isMore
              ? moreOpen
              : item.href !== '#more' && isActive(item.href);
            const showBell = isMore && unreadCount > 0;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (isMore) setMoreOpen(true);
                  else window.location.href = item.href;
                }}
                className={cn(
                  'relative flex flex-col items-center justify-center py-2 text-xs gap-0.5 min-h-[56px] transition-colors',
                  active ? 'text-navy-700 font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {showBell && (
                    <span className="absolute -top-1 -right-1.5 bg-destructive text-destructive-foreground text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
                {active && !isMore && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-navy-700 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div className="relative mt-auto bg-card rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-bold">All sections</h2>
                <p className="text-xs text-muted-foreground">
                  Signed in as {roleLabel(role)}
                </p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-md hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-2 py-2 pb-safe">
              {MORE_SECTIONS.map((section) => {
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
                                'flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors min-h-[48px]',
                                active && 'bg-navy-50 text-navy-700 font-medium',
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{item.label}</div>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
