import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Button } from '@/components/ui/button';
import { renderMarkdown, stripLeadingHeading } from '@/lib/utils-markdown';
import { MarkCompleteButton } from '@/components/learn/mark-complete-button';

export const dynamic = 'force-dynamic';

function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

export default async function LessonPage({
  params,
}: {
  params: { slug: string; lessonId: string };
}) {
  const user = await getUser();

  const lesson = await prisma.learningLesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: {
        include: { lessons: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!lesson || lesson.module.slug !== params.slug) notFound();
  if (!lesson.module.isPublished) notFound();
  if (
    !isAudienceMatch(lesson.module.audience, user?.role ?? 'MEMBER', user?.isAdmin ?? false)
  ) {
    notFound();
  }

  const lessonIndex = lesson.module.lessons.findIndex((l) => l.id === lesson.id);
  const prev = lessonIndex > 0 ? lesson.module.lessons[lessonIndex - 1] : null;
  const next = lessonIndex < lesson.module.lessons.length - 1 ? lesson.module.lessons[lessonIndex + 1] : null;

  let completed = false;
  if (user) {
    const p = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    });
    completed = !!p;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-28 md:pb-0">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 h-9 text-muted-foreground">
          <Link href={`/learn/${lesson.module.slug}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {lesson.module.title}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-navy-200 bg-navy-50 px-2.5 py-0.5 font-semibold text-navy-700">
            Lesson {lesson.order}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {lesson.estimatedMin} min
          </span>
          {completed && (
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
            </span>
          )}
        </div>

        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {lesson.title}
        </h1>
      </header>

      {/* Lesson body. Borderless -- the heading above already carries the
          title, and the body opens with a copy of it. */}
      <article
        className="lesson-content"
        dangerouslySetInnerHTML={{
          __html: renderMarkdown(stripLeadingHeading(lesson.content)),
        }}
      />

      {/* Up next */}
      {next && (
        <section className="flex items-center justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50/60 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">
              Up next
            </p>
            <p className="mt-0.5 font-medium leading-snug">{next.title}</p>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`/learn/${lesson.module.slug}/${next.id}`}>
              Next lesson
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      )}

      {!next && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 text-center">
          <p className="font-heading font-semibold text-emerald-700">
            You have finished all the lessons
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Take the end-of-module quiz to test your understanding.
          </p>
          <Button asChild className="mt-3">
            <Link href={`/learn/${lesson.module.slug}/quiz`}>
              {completed ? 'Retake quiz' : 'Start quiz'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      )}

      {/* Action bar -- pinned to the bottom of a phone, in flow on desktop */}
      <div className="learn-action-bar">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {prev ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label={`Previous lesson: ${prev.title}`}
            >
              <Link href={`/learn/${lesson.module.slug}/${prev.id}`}>
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <span className="h-11 w-11 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            {user && <MarkCompleteButton lessonId={lesson.id} initialComplete={completed} />}
          </div>

          {next ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label={`Next lesson: ${next.title}`}
            >
              <Link href={`/learn/${lesson.module.slug}/${next.id}`}>
                <ChevronRight className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <span className="h-11 w-11 shrink-0" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
