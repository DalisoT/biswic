'use client';

import { useEffect, useState, useRef, useTransition } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/browser';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/server/actions/notifications';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface Props {
  userId: string;
  initialUnreadCount: number;
  initialItems: NotificationItem[];
}

const TYPE_ICONS: Record<string, string> = {
  CONTRIBUTION: '💰',
  CLAIM: '🩺',
  MEETING: '📅',
  EVENT: '🎉',
  LOAN: '🤝',
  MEMBER: '👤',
  WELCOME: '👋',
  INFO: 'ℹ️',
};

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function NotificationBell({ userId, initialUnreadCount, initialItems }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [pending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Notification',
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          const newItem = payload.new as any;
          const item: NotificationItem = {
            id: newItem.id,
            type: newItem.type,
            title: newItem.title,
            body: newItem.body,
            link: newItem.link,
            read: newItem.read,
            createdAt: newItem.createdAt,
          };
          setItems((prev) => [item, ...prev].slice(0, 50));
          if (!item.read) {
            setUnreadCount((c) => c + 1);
            setToast(item);
            // Auto-dismiss toast after 5s
            setTimeout(() => setToast((t) => (t?.id === item.id ? null : t)), 5000);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = (id: string) => {
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      await markNotificationReadAction(fd);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, read: true } : it)));
      setUnreadCount((c) => Math.max(0, c - 1));
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      setUnreadCount(0);
    });
  };

  const handleClick = (item: NotificationItem) => {
    if (!item.read) handleMarkRead(item.id);
    if (item.link) {
      setOpen(false);
      window.location.href = item.link;
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen((o) => !o)}
          aria-label="Notifications"
        >
          <div className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-semibold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </Button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto bg-popover border rounded-md shadow-lg z-50">
            <div className="sticky top-0 bg-popover border-b px-4 py-2 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAll}
                  disabled={pending}
                  className="h-7 text-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleClick(item)}
                      className={`w-full text-left px-4 py-3 border-b hover:bg-muted transition-colors ${
                        !item.read ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg shrink-0">{TYPE_ICONS[item.type] ?? 'ℹ️'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm ${!item.read ? 'font-semibold' : 'font-medium'}`}>
                              {item.title}
                            </p>
                            {!item.read && (
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {timeAgo(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="sticky bottom-0 bg-popover border-t px-4 py-2 text-center">
              <a
                href="/notifications"
                className="text-xs text-emerald-600 hover:underline font-medium"
                onClick={() => setOpen(false)}
              >
                See all notifications →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Toast for new notifications */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-sm bg-popover border rounded-lg shadow-lg p-4 flex items-start gap-3"
          role="status"
        >
          <span className="text-2xl shrink-0">{TYPE_ICONS[toast.type] ?? 'ℹ️'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{toast.title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{toast.body}</p>
            {toast.link && (
              <a
                href={toast.link}
                className="text-xs text-emerald-600 hover:underline mt-1 inline-block"
              >
                View →
              </a>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
