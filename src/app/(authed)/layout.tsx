import { requireUser } from '@/lib/auth/require-user';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { TopBar } from '@/components/layout/topbar';
import { prisma } from '@/lib/db';

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} fullName={user.fullName} />
      <main className="md:pl-64 pb-20 md:pb-0">
        <TopBar
          fullName={user.fullName}
          serviceNumber={user.serviceNumber}
          unreadCount={unreadCount}
        />
        <div className="px-4 md:px-8 py-4 md:py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <MobileNav role={user.role} unreadCount={unreadCount} />
    </div>
  );
}
