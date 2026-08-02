'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Coins, Heart, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Group', href: '/group', icon: Users },
  { label: 'Pay', href: '/contributions', icon: Coins },
  { label: 'Claims', href: '/claims', icon: Heart },
  { label: 'More', href: '/settings', icon: Menu },
];

export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-30">
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-2 text-xs gap-1 min-h-[56px]',
                isActive ? 'text-navy-700' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
