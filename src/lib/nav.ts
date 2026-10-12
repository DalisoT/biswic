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
  UserPlus,
  Wallet,
  ShieldAlert,
  GraduationCap,
  Bell,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for platform navigation.
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *
 * The desktop sidebar, the mobile bottom bar + "More" sheet, and the command
 * palette previously each hardcoded their OWN list of links. They silently
 * drifted apart. The worst symptom: `/learn` -- the Zambia financial-literacy
 * hub, open to every member -- existed only in the desktop sidebar, which is
 * `hidden md:flex`. On a phone there was no link to Learn anywhere in the UI,
 * so the feature was unreachable on the platform's primary device.
 *
 * Mobile was also missing Group, All Contributions, Loan Applications, Loan
 * Register, Loan Defaults and Locked Accounts.
 *
 * Never hardcode a destination in a navigation component again. Add it here.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If defined, only these roles see the item. Omit for "everyone". */
  roles?: string[];
  /** Short helper text, shown in the mobile "More" sheet. */
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const FINANCE_ROLES = [
  'CHAIRPERSON',
  'SECRETARY',
  'FW',
  'TREASURER',
  'DEPUTY_TREASURER',
  'CCD',
  'TRUSTEE',
];

const MEMBER_ROSTER_ROLES = [
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'SECRETARY',
  'FW',
  'TREASURER',
  'DEPUTY_TREASURER',
  'CCD',
  'TRUSTEE',
];

const OFFICER_ROLES = [
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'SECRETARY',
  'TREASURER',
  'DEPUTY_TREASURER',
  'FW',
  'CCD',
];

/**
 * Full navigation, grouped for the mobile "More" sheet.
 * Section order is the order members see on both desktop and mobile.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Your overview',
      },
      {
        label: 'Group',
        href: '/group',
        icon: Users,
        description: 'Committee + structure',
      },
      {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        description: 'Recent activity',
      },
    ],
  },
  {
    title: 'My cooperative',
    items: [
      {
        label: 'My Contributions',
        href: '/contributions',
        icon: Coins,
        description: 'Your monthly payments',
      },
      {
        label: 'Soft Loans',
        href: '/soft-loans',
        icon: HandCoins,
        description: 'Apply, repay, status',
      },
      {
        label: 'Welfare Claims',
        href: '/claims',
        icon: Heart,
        description: 'Submit or track a claim',
      },
      {
        label: 'Learn',
        href: '/learn',
        icon: GraduationCap,
        description: 'Financial literacy hub',
      },
      {
        label: 'My Learning',
        href: '/learn/me',
        icon: GraduationCap,
        description: 'Your progress + quizzes',
      },
      {
        label: 'Statement',
        href: '/statement',
        icon: BarChart3,
        description: 'Your statement',
      },
    ],
  },
  {
    title: 'Cooperative',
    items: [
      {
        label: 'Members',
        href: '/members',
        icon: UserPlus,
        roles: MEMBER_ROSTER_ROLES,
        description: 'Roster + add members',
      },
      {
        label: 'Meetings',
        href: '/meetings',
        icon: Calendar,
        description: 'Monthly + AGMs',
      },
      {
        label: 'Documents',
        href: '/documents',
        icon: FileText,
        description: 'Constitution + reports',
      },
      {
        label: 'Land Pipeline',
        href: '/land',
        icon: Map,
        roles: ['CCD', 'LSC_MEMBER', 'CHAIRPERSON', 'FW'],
        description: 'Plots + scouts',
      },
      {
        label: 'Businesses',
        href: '/businesses',
        icon: Briefcase,
        roles: ['CCD', 'BUSINESS_MEMBER', 'CHAIRPERSON', 'FW'],
        description: 'Investments + returns',
      },
      {
        label: 'Events & Charity',
        href: '/events',
        icon: CalendarDays,
        description: 'Outreach',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Finance',
        href: '/finance',
        icon: Wallet,
        roles: FINANCE_ROLES,
        description: 'Buckets, payroll, register',
      },
      {
        label: 'All Contributions',
        href: '/finance/contributions',
        icon: Coins,
        roles: FINANCE_ROLES,
        description: 'Every member, every month',
      },
      {
        label: 'Loan Applications',
        href: '/finance/soft-loan-applications',
        icon: HandCoins,
        roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD'],
        description: 'Approve or decline',
      },
      {
        label: 'Loan Register',
        href: '/finance/soft-loan-register',
        icon: FileText,
        roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'],
        description: 'Live disbursements',
      },
      {
        label: 'Loan Defaults',
        href: '/finance/soft-loan-defaults',
        icon: AlertCircle,
        roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER', 'CCD'],
        description: 'Missed repayments',
      },
      {
        label: 'Reports',
        href: '/reports',
        icon: BarChart3,
        roles: ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'],
        description: 'Financial reports',
      },
      {
        label: 'Audit Log',
        href: '/audit',
        icon: Shield,
        roles: ['FW', 'CHAIRPERSON', 'TRUSTEE', 'INTERNAL_AUDITOR'],
        description: 'Who changed what',
      },
      {
        label: 'Locked Accounts',
        href: '/admin/lockouts',
        icon: ShieldAlert,
        roles: OFFICER_ROLES,
        description: 'Suspended members',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        description: 'Update your details',
      },
    ],
  },
];

/** Flat, role-filtered list -- used by the desktop sidebar. */
export function navItemsForRole(role: string): NavItem[] {
  return NAV_SECTIONS.flatMap((section) => section.items).filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}

/**
 * Bottom tab bar. Four destinations plus "More" fills a 5-column grid.
 * Learn is a first-class tab rather than being buried in the sheet: it is the
 * one member-facing feature that had no mobile entry point at all, and burying
 * it again would just hide the regression.
 */
export const MOBILE_TAB_HREFS = [
  '/dashboard',
  '/learn',
  '/contributions',
  '/soft-loans',
] as const;