'use client';

import { useState, useTransition } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  initial: NotificationItem[];
  typeIcons: Record<string, string>;
}

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
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function NotificationsList({ initial, typeIcons }: Props) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const unreadCount = items.filter((i) => !i.read).length;

  const handleMarkRead = (id: string) => {
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      await markNotificationReadAction(fd);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, read: true } : it)));
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    });
  };

  const handleClick = (item: NotificationItem) => {
    if (!item.read) handleMarkRead(item.id);
    if (item.link) window.location.href = item.link;
  };

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={pending}>
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Mark all read ({unreadCount})
          </Button>
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => handleClick(item)}
              className={`w-full text-left p-3 rounded-md border hover:bg-muted transition-colors ${
                !item.read ? 'bg-emerald-50/40 border-emerald-200' : 'bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{typeIcons[item.type] ?? 'ℹ️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!item.read ? 'font-semibold' : 'font-medium'}`}>
                      {item.title}
                    </p>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
