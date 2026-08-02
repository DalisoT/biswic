import { requireUser } from '@/lib/auth/require-user';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
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
      <main className="md:pl-64 pb-16 md:pb-0">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <MobileNav role={user.role} />
    </div>
  );
}
