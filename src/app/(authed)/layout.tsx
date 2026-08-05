import { requireUser } from '@/lib/auth/require-user';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { prisma } from '@/lib/db';

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [unreadCount, recentNotifications] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  const initialBellItems = recentNotifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} fullName={user.fullName} />
      <main className="md:pl-64 pb-16 md:pb-0">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center justify-end h-14 px-4 md:px-8 max-w-7xl">
            <NotificationBell
              userId={user.id}
              initialUnreadCount={unreadCount}
              initialItems={initialBellItems}
            />
          </div>
        </div>
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <MobileNav role={user.role} />
    </div>
  );
}
