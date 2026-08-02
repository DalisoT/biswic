'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/server/actions/auth';

interface TopBarProps {
  title: string;
  userServiceNumber: string;
  unreadCount?: number;
}

export function TopBar({ title, userServiceNumber, unreadCount = 0 }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSignOut = () => {
    setMenuOpen(false);
    startTransition(async () => {
      await signOutAction();
      // signOutAction always redirects, but the type system needs a fallback.
      router.push('/login');
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-background border-b">
      <div className="flex items-center justify-between h-14 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold font-heading">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <a href="/notifications" aria-label="Notifications">
              <div className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </a>
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(!menuOpen)}
              className="gap-2"
              disabled={pending}
            >
              <span className="hidden sm:inline text-sm">{userServiceNumber}</span>
            </Button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-popover border rounded-md shadow-lg z-50">
                  <div className="px-4 py-2 border-b">
                    <div className="text-sm font-medium">{userServiceNumber}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={pending}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {pending ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
