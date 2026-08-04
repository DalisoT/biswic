'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Coins,
  Heart,
  Calendar,
  FileText,
  Map,
  Briefcase,
  CalendarDays,
  Settings,
  Shield,
  BarChart3,
  HandCoins,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { roleLabel } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[]; // if defined, only these roles see this item
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Group', href: '/group', icon: Users },
  { label: 'My Contributions', href: '/contributions', icon: Coins },
  { label: 'Welfare Claims', href: '/claims', icon: Heart },
  { label: 'Soft Loans', href: '/soft-loans', icon: HandCoins },
  { label: 'Meetings', href: '/meetings', icon: Calendar },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Statements', href: '/statement', icon: BarChart3 },
  { label: 'Land Pipeline', href: '/land', icon: Map, roles: ['CCD', 'LSC_MEMBER', 'CHAIRPERSON', 'FW'] },
  { label: 'Businesses', href: '/businesses', icon: Briefcase, roles: ['CCD', 'BUSINESS_MEMBER', 'CHAIRPERSON', 'FW'] },
  { label: 'Events & Charity', href: '/events', icon: CalendarDays },
  { label: 'Audit Log', href: '/audit', icon: Shield, roles: ['FW', 'CHAIRPERSON', 'TRUSTEE', 'INTERNAL_AUDITOR'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'] },
  { label: 'Loan Applications', href: '/finance/soft-loan-applications', icon: HandCoins, roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD'] },
  { label: 'Loan Register', href: '/finance/soft-loan-register', icon: FileText, roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'] },
  { label: 'Loan Defaults', href: '/finance/soft-loan-defaults', icon: AlertCircle, roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD'] },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  const allowed = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="px-6 py-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-navy-700 flex items-center justify-center text-white font-bold">
              B
            </div>
            <div>
              <div className="font-bold text-navy-700">BISWIC</div>
              <div className="text-xs text-muted-foreground">Member Platform</div>
            </div>
          </Link>
        </div>

        <div className="px-4 py-4 border-b">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="font-semibold text-sm truncate">{fullName}</div>
          <div className="text-xs text-muted-foreground mt-1">{roleLabel(role)}</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {allowed.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-navy-700 text-white'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t text-xs text-muted-foreground">
          v1.0 · {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
