'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Home,
  Users,
  Coins,
  Heart,
  HandCoins,
  Calendar,
  FileText,
  Map,
  Briefcase,
  CalendarDays,
  BarChart3,
  Settings as SettingsIcon,
  Bell,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/permissions';

interface PageItem {
  type: 'page';
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  section: string;
  roles?: string[];
}

interface MemberItem {
  type: 'member';
  id: string;
  serviceNumber: string;
  fullName: string;
  rank: string | null;
  href: string;
}

interface RecentItem {
  type: 'recent';
  label: string;
  href: string;
  icon: LucideIcon;
}

type AnyItem = PageItem | MemberItem | RecentItem;

const PAGES: PageItem[] = [
  { type: 'page', href: '/dashboard', label: 'Dashboard', icon: Home, section: 'Main' },
  { type: 'page', href: '/notifications', label: 'Notifications', icon: Bell, section: 'Main' },
  { type: 'page', href: '/settings', label: 'Settings', icon: SettingsIcon, section: 'Main' },
  { type: 'page', href: '/contributions', label: 'My contributions', icon: Coins, section: 'Money' },
  { type: 'page', href: '/claims', label: 'Welfare claims', icon: Heart, section: 'Money' },
  { type: 'page', href: '/claims/new', label: 'Submit a claim', icon: Heart, section: 'Money' },
  { type: 'page', href: '/soft-loans', label: 'Soft loans', icon: HandCoins, section: 'Money' },
  { type: 'page', href: '/soft-loans/apply', label: 'Apply for a loan', icon: HandCoins, section: 'Money' },
  { type: 'page', href: '/statement', label: 'My statement', icon: BarChart3, section: 'Money' },
  { type: 'page', href: '/members', label: 'Members roster', icon: Users, section: 'Cooperative', roles: ['CHAIRPERSON', 'SECRETARY', 'FW', 'TREASURER', 'CCD', 'VICE_CHAIRPERSON', 'DEPUTY_TREASURER', 'TRUSTEE'] },
  { type: 'page', href: '/members/new', label: 'Add new member', icon: Users, section: 'Cooperative', roles: ['CHAIRPERSON', 'SECRETARY'] },
  { type: 'page', href: '/finance', label: 'Finance dashboard', icon: Wallet, section: 'Cooperative', roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD', 'TRUSTEE', 'SECRETARY'] },
  { type: 'page', href: '/finance/contributions', label: 'All contributions', icon: Coins, section: 'Cooperative', roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD', 'TRUSTEE', 'SECRETARY'] },
  { type: 'page', href: '/finance/contributions/import', label: 'Import payroll', icon: Coins, section: 'Cooperative', roles: ['TREASURER', 'DEPUTY_TREASURER', 'FW'] },
  { type: 'page', href: '/finance/soft-loan-applications', label: 'Loan applications', icon: HandCoins, section: 'Cooperative', roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD'] },
  { type: 'page', href: '/meetings', label: 'Meetings', icon: Calendar, section: 'Cooperative' },
  { type: 'page', href: '/documents', label: 'Documents', icon: FileText, section: 'Cooperative' },
  { type: 'page', href: '/land', label: 'Land pipeline', icon: Map, section: 'Cooperative', roles: ['CCD', 'LSC_MEMBER', 'CHAIRPERSON', 'FW'] },
  { type: 'page', href: '/businesses', label: 'Businesses', icon: Briefcase, section: 'Cooperative', roles: ['CCD', 'BUSINESS_MEMBER', 'CHAIRPERSON', 'FW'] },
  { type: 'page', href: '/events', label: 'Events & charity', icon: CalendarDays, section: 'Cooperative' },
  { type: 'page', href: '/reports', label: 'Reports', icon: BarChart3, section: 'Cooperative', roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'] },
  { type: 'page', href: '/audit', label: 'Audit log', icon: FileText, section: 'Cooperative', roles: ['FW', 'CHAIRPERSON', 'TRUSTEE', 'INTERNAL_AUDITOR'] },
];

const RECENT_KEY = 'biswic.recentSearches';
const RECENT_MAX = 5;

function loadRecent(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_MAX)));
  } catch {
    // ignore
  }
}

interface Props {
  userId: string;
  role: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ userId, role, open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter pages by role
  const allowedPages = useMemo(
    () => PAGES.filter((p) => !p.roles || p.roles.includes(role)),
    [role],
  );

  // Lazy-load members on first open
  useEffect(() => {
    if (!open || members.length > 0 || membersLoading) return;
    setMembersLoading(true);
    fetch('/api/search/members')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [open, members.length, membersLoading]);

  // Load recent
  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  // Focus the input when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Build the filtered list
  const results = useMemo<AnyItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query: show recent + a few default pages
      const top = allowedPages.slice(0, 5);
      return [...recent, ...top];
    }
    const matches: AnyItem[] = [];
    // Pages
    for (const p of allowedPages) {
      const hay = `${p.label} ${p.description ?? ''} ${p.section}`.toLowerCase();
      if (hay.includes(q)) matches.push(p);
    }
    // Members
    for (const m of members) {
      const hay = `${m.serviceNumber} ${m.fullName} ${m.rank ?? ''}`.toLowerCase();
      if (hay.includes(q)) matches.push(m);
    }
    return matches.slice(0, 30);
  }, [query, allowedPages, members, recent]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Scroll the highlighted item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const handleSelect = useCallback(
    (item: AnyItem) => {
      // Save to recent (only for pages)
      if (item.type === 'page') {
        const next: RecentItem[] = [
          { type: 'recent', label: item.label, href: item.href, icon: item.icon },
          ...recent.filter((r) => r.href !== item.href),
        ].slice(0, RECENT_MAX);
        setRecent(next);
        saveRecent(next);
      }
      onOpenChange(false);
      router.push(item.href);
    },
    [recent, router, onOpenChange],
  );

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = results[highlight];
        if (item) handleSelect(item);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, highlight, handleSelect, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        className="relative w-full max-w-xl bg-popover border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-2"
        role="dialog"
        aria-label="Search and jump to"
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, members…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 h-5 text-[10px] font-mono bg-muted text-muted-foreground rounded border">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query ? 'No results' : 'Start typing to search'}
            </div>
          ) : (
            <ul>
              {results.map((item, i) => {
                const isHighlighted = i === highlight;
                if (item.type === 'page' || item.type === 'recent') {
                  const Icon = item.icon;
                  return (
                    <li key={`${item.type}-${item.href}-${i}`} data-idx={i}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setHighlight(i)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isHighlighted ? 'bg-muted' : 'hover:bg-muted/50',
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.label}</div>
                          {item.type === 'page' && item.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {item.type === 'page' && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            {item.section}
                          </span>
                        )}
                        {item.type === 'recent' && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Recent
                          </span>
                        )}
                      </button>
                    </li>
                  );
                }
                // Member
                return (
                  <li key={`m-${item.id}-${i}`} data-idx={i}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isHighlighted ? 'bg-muted' : 'hover:bg-muted/50',
                      )}
                    >
                      <span className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-navy-700 text-white text-[10px] font-semibold shrink-0">
                        {item.fullName
                          .split(' ')
                          .slice(0, 2)
                          .map((s) => s[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.fullName}</div>
                        <div className="text-xs text-muted-foreground truncate font-mono">
                          {item.serviceNumber} {item.rank ? `· ${item.rank}` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Member
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden sm:flex items-center justify-between gap-2 px-4 py-2 border-t text-[10px] text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 h-4 font-mono bg-background border rounded">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 h-4 font-mono bg-background border rounded">↵</kbd> open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 h-4 font-mono bg-background border rounded">esc</kbd> close
            </span>
          </div>
          <span>
            Signed in as {roleLabel(role)} · {userId.slice(0, 6)}…
          </span>
        </div>
      </div>
    </div>
  );
}
