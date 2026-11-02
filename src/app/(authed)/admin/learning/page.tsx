import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import { AdminLessonEditor } from '@/components/learn/admin-lesson-editor';
import { AdminImportPanel } from '@/components/learn/admin-import-panel';

export const dynamic = 'force-dynamic';

const OFFICER_ROLES = [
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'SECRETARY',
  'TREASURER',
  'DEPUTY_TREASURER',
  'FW',
  'CCD',
];

export default async function AdminLearningPage() {
  const user = await requireUser();
  if (!user.isAdmin && !OFFICER_ROLES.includes(user.role)) {
    redirect('/dashboard');
  }

  const modules = await prisma.learningModule.findMany({
    orderBy: [{ order: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      isPublished: true,
      order: true,
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, order: true, title: true, content: true, estimatedMin: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Learning Hub editor</h1>
        <p className="text-sm text-muted-foreground">
          Edit any lesson, or apply a content bundle. Nothing is ever deleted, and no member loses progress.
        </p>
      </header>

      <AdminLessonEditor modules={modules} />
      <AdminImportPanel />
    </div>
  );
}
