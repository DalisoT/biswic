import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { markAllRead } from '@/server/actions/notifications';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Mark all as read on view
  await markAllRead(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 50 notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No notifications yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`p-3 border rounded-md ${n.read ? 'bg-background' : 'bg-muted/50'}`}
                >
                  <div className="flex items-start gap-3">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-navy-700 mt-2 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{n.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
                      <div className="text-xs text-muted-foreground mt-1">{formatDate(n.createdAt)}</div>
                    </div>
                    {n.link && (
                      <Link href={n.link} className="text-sm text-navy-700 hover:underline">
                        View
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
