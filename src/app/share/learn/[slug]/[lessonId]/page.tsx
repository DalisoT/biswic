import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { renderMarkdown, stripLeadingHeading } from '@/lib/utils-markdown';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string; lessonId: string } };

/**
 * Load the lesson a shared link points at.
 *
 * The lesson is identified by its id, not by its position in the module: if a
 * lesson were ever reordered, a positional URL would silently open a
 * *different* lesson, whereas an id either resolves or 404s.
 */
async function loadLesson(slug: string, lessonId: string) {
  const learningModule = await prisma.learningModule.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      audience: true,
      isPublished: true,
      lessons: {
        where: { id: lessonId },
        select: { id: true, title: true, content: true, estimatedMin: true, order: true },
      },
    },
  });

  if (!learningModule || !learningModule.isPublished) return null;
  const lesson = learningModule.lessons[0];
  if (!lesson) return null;
  return { learningModule, lesson };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadLesson(params.slug, params.lessonId);
  if (!data) return { title: 'Lesson not found', robots: { index: false } };

  const title = `${data.lesson.title} — ${data.learningModule.title}`;
  return {
    title,
    description: data.learningModule.summary,
    robots: { index: false, follow: false },
    openGraph: { title, description: data.learningModule.summary, type: 'article' },
  };
}

export default async function SharedLessonPage({ params }: Props) {
  const data = await loadLesson(params.slug, params.lessonId);
  if (!data) notFound();
  const { learningModule, lesson } = data;

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">{learningModule.title}</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {lesson.estimatedMin} min read
        </div>
      </header>

      <div
        className="lesson-content"
        dangerouslySetInnerHTML={{
          __html: renderMarkdown(stripLeadingHeading(lesson.content)),
        }}
      />

      <p className="rounded-lg border border-gold-200 bg-gold-50/60 p-4 text-sm text-muted-foreground">
        Shared from the BISWIC Financial Literacy Hub. Sign in to work through every module and keep your progress.
      </p>
    </article>
  );
}
