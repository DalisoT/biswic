'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/permissions';
import { navItemsForRole } from '@/lib/nav';

/**
 * Desktop sidebar. Sourced from `src/lib/nav.ts` so it cannot drift away from
 * the mobile navigation again (see the note in that file).
 */
export function Sidebar({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  const allowed = navItemsForRole(role);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="px-6 py-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img
              src="/icons/favicon-96x96.png"
              alt="BISWIC"
              width={40}
              height={40}
              className="w-10 h-10 rounded-md object-contain shrink-0"
            />
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

        <nav aria-label="Primary" className="flex-1 px-3 py-4 space-y-1">
          {allowed.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[40px]',
                  isActive ? 'bg-navy-700 text-white' : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t text-xs text-muted-foreground">
          v1.0 &middot; {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}