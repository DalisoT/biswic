import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, GraduationCap, ListChecks } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Button } from '@/components/ui/button';
import { renderMarkdown } from '@/lib/utils-markdown';

export const dynamic = 'force-dynamic';

function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

/** The seed writes this placeholder instead of real module content. */
const MODULE_CONTENT_PLACEHOLDER = 'See lessons for content.';

export default async function LearnModulePage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getUser();

  const learningModule = await prisma.learningModule.findUnique({
    where: { slug: params.slug },
    include: {
      lessons: { orderBy: { order: 'asc' } },
      quiz: { select: { id: true, passingScore: true } },
    },
  });

  if (!learningModule || !learningModule.isPublished) notFound();
  if (
    !isAudienceMatch(learningModule.audience, user?.role ?? 'MEMBER', user?.isAdmin ?? false)
  ) {
    notFound();
  }

  // Per-user progress
  let completedLessonIds = new Set<string>();
  let bestQuizScore: number | null = null;
  let bestQuizPassed: boolean | null = null;
  if (user) {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: user.id, lessonId: { in: learningModule.lessons.map((l) => l.id) } },
      select: { lessonId: true },
    });
    completedLessonIds = new Set(progress.map((p) => p.lessonId));
    if (learningModule.quiz) {
      const completed = await prisma.quizAttempt.findMany({
        where: { userId: user.id, quizId: learningModule.quiz.id, completedAt: { not: null } },
        select: { score: true, passed: true },
      });
      if (completed.length > 0) {
        const best = completed.reduce((acc, cur) => (cur.score > acc.score ? cur : acc));
        bestQuizScore = best.score;
        bestQuizPassed = best.passed;
      }
    }
  }

  const totalLessons = learningModule.lessons.length;
  const completedCount = learningModule.lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const allLessonsDone = completedCount === totalLessons && totalLessons > 0;
  const totalMinutes = learningModule.lessons.reduce((sum, l) => sum + l.estimatedMin, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // The module summary is already printed in the header, so the "about" card
  // is only worth showing when the module carries content of its own.
  const moduleContent = (learningModule.content ?? '').trim();
  const showAbout =
    moduleContent.length > 0 &&
    moduleContent !== MODULE_CONTENT_PLACEHOLDER &&
    moduleContent !== (learningModule.summary ?? '').trim();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 h-9 text-muted-foreground">
          <Link href="/learn">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All modules
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-700">
              <GraduationCap className="h-3 w-3" />
              Module {learningModule.order}
            </span>
            <h1 className="mt-2.5 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {learningModule.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {learningModule.summary}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />~{totalMinutes} min
              </span>
              <span>
                {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
              </span>
              {learningModule.quiz && (
                <span className="flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" />
                  {learningModule.quiz.passingScore}% to pass
                </span>
              )}
            </div>
          </div>

          {user && totalLessons > 0 && (
            <div className="shrink-0 rounded-lg border bg-card px-4 py-3 text-right">
              <p className="font-heading text-2xl font-bold text-navy-700">{progressPct}%</p>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{totalLessons} lessons
              </p>
            </div>
          )}
        </div>
      </header>

      {/* About this module -- only when there is content beyond the summary */}
      {showAbout && (
        <section className="rounded-lg border bg-card p-4 sm:p-6">
          <h2 className="mb-3 font-heading text-lg font-semibold">About this module</h2>
          <div className="lesson-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(moduleContent) }} />
        </section>
      )}

      {/* Lessons */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Lessons</h2>
        <ol className="divide-y overflow-hidden rounded-lg border bg-card">
          {learningModule.lessons.map((lesson, idx) => {
            const completed = completedLessonIds.has(lesson.id);
            return (
              <li key={lesson.id}>
                <Link
                  href={`/learn/${learningModule.slug}/${lesson.id}`}
                  className="flex min-h-[64px] items-center gap-3 p-3.5 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:bg-muted/60"
                >
                  <span
                    className={
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ' +
                      (completed
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'border border-navy-200 bg-navy-50 text-navy-700')
                    }
                  >
                    {completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{lesson.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      ~{lesson.estimatedMin} min
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Quiz CTA */}
      {learningModule.quiz && (
        <section className="rounded-lg border border-gold-200 bg-gold-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <ListChecks className="h-5 w-5 text-gold-700" />
                End-of-module quiz
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {learningModule.quiz.passingScore}% to pass. Retake it as many times as you need.
                {bestQuizScore !== null && (
                  <>
                    {' '}
                    Best score so far:{' '}
                    <span
                      className={
                        bestQuizPassed ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'
                      }
                    >
                      {bestQuizScore}%
                    </span>
                    {bestQuizPassed ? ' (passed)' : ' (try again)'}
                  </>
                )}
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`/learn/${learningModule.slug}/quiz`}>
                {bestQuizScore === null ? 'Start quiz' : 'Retake quiz'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {!allLessonsDone && user && (
            <p className="mt-3 text-sm text-muted-foreground">
              Complete all {totalLessons} lessons to unlock the quiz.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
