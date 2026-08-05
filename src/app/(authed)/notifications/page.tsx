import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { NotificationsList } from '@/components/notifications/notifications-list';

export const dynamic = 'force-dynamic';

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

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const initial = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notifications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''} ·{' '}
          {notifications.filter((n) => !n.read).length} unread
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                You&apos;ll see updates here when contributions are recorded, claims change status, meetings are scheduled, and events are announced.
              </p>
            </div>
          ) : (
            <NotificationsList initial={initial} typeIcons={TYPE_ICONS} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
