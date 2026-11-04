import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Financial Literacy Hub · BISWIC',
  description:
    'Self-paced learning for BISWIC members. Cooperative basics, soft loans, savings and AGM prep — with quizzes to verify understanding.',
};

function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

function progressFor(progresses: { lessonId: string }[], lessonIds: string[]): number {
  if (lessonIds.length === 0) return 0;
  const done = new Set(progresses.map((p) => p.lessonId));
  const completed = lessonIds.filter((id) => done.has(id)).length;
  return Math.round((completed / lessonIds.length) * 100);
}

function bestQuizScore(attempts: { score: number; passed: boolean; completedAt: Date | null }[]): { score: number | null; passed: boolean | null } {
  const completed = attempts.filter((a) => a.completedAt !== null);
  if (completed.length === 0) return { score: null, passed: null };
  const best = completed.reduce((acc, cur) => (cur.score > acc.score ? cur : acc));
  return { score: best.score, passed: best.passed };
}

export default async function LearnHomePage() {
  const user = await getUser();

  const modules = await prisma.learningModule.findMany({
    where: { isPublished: true },
    include: {
      lessons: { select: { id: true } },
      quiz: { select: { id: true, passingScore: true } },
    },
    orderBy: { order: 'asc' },
  });

  // Per-user progress (only for authenticated members)
  let progresses: { lessonId: string }[] = [];
  let attempts: { quizId: string; score: number; passed: boolean; completedAt: Date | null }[] = [];
  if (user) {
    progresses = await prisma.lessonProgress.findMany({
      where: { userId: user.id },
      select: { lessonId: true },
    });
    const quizIds = modules.map((m) => m.quiz?.id).filter((id): id is string => !!id);
    if (quizIds.length > 0) {
      attempts = await prisma.quizAttempt.findMany({
        where: { userId: user.id, quizId: { in: quizIds } },
        select: { quizId: true, score: true, passed: true, completedAt: true },
      });
    }
  }

  const visible = modules.filter((m) => isAudienceMatch(m.audience, user?.role ?? 'MEMBER', user?.isAdmin ?? false));

  const totalLessons = visible.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = visible.reduce((sum, m) => {
    const lessonIds = m.lessons.map((l) => l.id);
    return sum + lessonIds.filter((id) => progresses.some((p) => p.lessonId === id)).length;
  }, 0);
  const quizCount = visible.filter((m) => m.quiz).length;
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const stats = [
    { label: 'Modules', value: visible.length },
    { label: 'Lessons', value: totalLessons },
    { label: 'Quizzes', value: quizCount },
  ];

  return (
    <div className="space-y-8">
      {/* Header -- the app TopBar already carries the section name, so this
          is a content heading, not a second title bar. */}
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
          Financial literacy
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Learn the cooperative
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground sm:text-base">
              Short lessons in plain language, with a quiz at the end of every module.
            </p>
          </div>
          {user && (
            <Button asChild variant="outline" className="w-full shrink-0 justify-start sm:w-auto">
              <Link href="/learn/me">
                My progress
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Stat strip */}
      <section aria-label="Library overview" className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-0.5 font-heading text-xl font-bold sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </section>

      {/* Overall progress */}
      {user && totalLessons > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">Your progress</p>
            <p className="font-heading text-sm font-bold text-navy-700">{overallPct}%</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-navy-700 transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completedLessons} of {totalLessons} lessons complete
          </p>
        </section>
      )}

      {/* Module grid */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Modules</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {visible.map((m) => {
            const lessonIds = m.lessons.map((l) => l.id);
            const progress = user ? progressFor(progresses, lessonIds) : 0;
            const quizBest =
              user && m.quiz
                ? bestQuizScore(attempts.filter((a) => a.quizId === m.quiz!.id))
                : { score: null, passed: null };
            return (
              <Link
                key={m.id}
                href={`/learn/${m.slug}`}
                className="group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <article className="flex h-full flex-col rounded-lg border bg-card p-4 transition-colors group-hover:border-navy-300">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-200 bg-gold-50 font-heading text-sm font-bold text-gold-700">
                      {String(m.order).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-semibold leading-snug transition-colors group-hover:text-navy-800">
                        {m.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.summary}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {m.lessons.length} {m.lessons.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                    {m.quiz && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Quiz, {m.quiz.passingScore}% to pass</span>
                      </>
                    )}
                    {quizBest.passed === true && (
                      <Badge variant="success" className="ml-auto">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Passed
                      </Badge>
                    )}
                  </div>

                  {user && progress > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-navy-700 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{progress}% complete</p>
                    </div>
                  )}

                  {m.quiz && quizBest.score !== null && (
                    <p className="mt-2 text-xs">
                      <span
                        className={
                          quizBest.passed
                            ? 'font-medium text-emerald-700'
                            : 'font-medium text-amber-700'
                        }
                      >
                        Best score: {quizBest.score}%
                      </span>
                    </p>
                  )}
                </article>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
