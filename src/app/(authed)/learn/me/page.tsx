import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, ListChecks, XCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Learning · BISWIC',
};

function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

export default async function MyLearningPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/learn/me');

  const modules = await prisma.learningModule.findMany({
    where: {
      isPublished: true,
    },
    include: {
      lessons: { select: { id: true } },
      quiz: { select: { id: true, passingScore: true } },
    },
    orderBy: { order: 'asc' },
  });

  const visible = modules.filter((m) => isAudienceMatch(m.audience, user.role, user.isAdmin));

  const allLessonIds = visible.flatMap((m) => m.lessons.map((l) => l.id));
  const completedLessons = await prisma.lessonProgress.findMany({
    where: { userId: user.id, lessonId: { in: allLessonIds } },
    select: { lessonId: true, completedAt: true },
  });
  const completedLessonSet = new Set(completedLessons.map((c) => c.lessonId));

  const quizIds = visible.map((m) => m.quiz?.id).filter((id): id is string => !!id);
  const allAttempts = await prisma.quizAttempt.findMany({
    where: { userId: user.id, quizId: { in: quizIds } },
    orderBy: { completedAt: 'desc' },
  });

  const totalLessons = visible.reduce((s, m) => s + m.lessons.length, 0);
  const lessonsDone = visible.reduce(
    (s, m) => s + m.lessons.filter((l) => completedLessonSet.has(l.id)).length,
    0
  );
  const modulesStarted = visible.filter((m) =>
    m.lessons.some((l) => completedLessonSet.has(l.id))
  ).length;
  const modulesCompleted = visible.filter(
    (m) => m.lessons.length > 0 && m.lessons.every((l) => completedLessonSet.has(l.id))
  ).length;
  const quizzesPassed = visible.filter((m) => {
    if (!m.quiz) return false;
    const best = allAttempts.find((a) => a.quizId === m.quiz!.id && a.passed);
    return !!best;
  }).length;

  // Recent activity
  const recentAttempts = allAttempts
    .filter((a) => a.completedAt !== null)
    .slice(0, 5);

  const stats = [
    { label: 'Modules started', value: modulesStarted, total: visible.length, success: false },
    { label: 'Modules completed', value: modulesCompleted, total: null, success: true },
    { label: 'Lessons done', value: lessonsDone, total: totalLessons, success: false },
    { label: 'Quizzes passed', value: quizzesPassed, total: null, success: true },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
          Your progress
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">My learning</h1>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          Track where you are through the cooperative&apos;s financial literacy modules.
        </p>
      </header>

      {/* Stat grid -- 2x2 on a phone, 4 across on a wider screen */}
      <section aria-label="Progress summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p
              className={
                'mt-0.5 font-heading text-2xl font-bold ' +
                (s.success ? 'text-emerald-700' : 'text-navy-700')
              }
            >
              {s.value}
              {s.total !== null && (
                <span className="text-sm font-normal text-muted-foreground">/{s.total}</span>
              )}
            </p>
          </div>
        ))}
      </section>

      {/* Module list with progress */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Modules</h2>
        <div className="space-y-3">
          {visible.map((m) => {
            const lessonIds = m.lessons.map((l) => l.id);
            const done = lessonIds.filter((id) => completedLessonSet.has(id)).length;
            const total = lessonIds.length;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            const completed = total > 0 && done === total;
            const bestAttempt = m.quiz
              ? allAttempts
                  .filter(
                    (a): a is (typeof allAttempts)[number] & { completedAt: Date } =>
                      a.quizId === m.quiz!.id && a.completedAt !== null,
                  )
                  .reduce<null | { score: number; passed: boolean; completedAt: Date }>(
                    (acc, cur) => (!acc || cur.score > acc.score ? cur : acc),
                    null,
                  )
              : null;
            return (
              <article
                key={m.id}
                className={
                  'rounded-lg border bg-card p-4 ' + (completed ? 'border-emerald-200' : '')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 font-heading font-semibold leading-snug">
                      {completed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                      <span className="min-w-0">{m.title}</span>
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.summary}</p>
                  </div>
                  {m.quiz && bestAttempt && (
                    <Badge
                      variant={bestAttempt.passed ? 'success' : 'destructive'}
                      className="shrink-0"
                    >
                      Best: {bestAttempt.score}%
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {done}/{total} lessons
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-navy-700 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <Button asChild size="sm" variant={completed ? 'outline' : 'default'} className="mt-3">
                  <Link href={`/learn/${m.slug}`}>
                    {done === 0 ? 'Start' : done < total ? 'Continue' : 'Review'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      {/* Recent activity */}
      {recentAttempts.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
            <ListChecks className="h-5 w-5" />
            Recent quiz attempts
          </h2>
          <div className="overflow-hidden rounded-lg border bg-card">
            <ul className="divide-y">
              {recentAttempts.map((a) => {
                const mod = visible.find((m) => m.quiz?.id === a.quizId);
                return (
                  <li key={a.id} className="flex items-center gap-3 p-3.5">
                    {a.passed ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-snug">
                        {mod?.title ?? 'Unknown module'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.completedAt?.toLocaleString() ?? 'in progress'}
                      </p>
                    </div>
                    <Badge variant={a.passed ? 'success' : 'destructive'} className="shrink-0">
                      {a.score}%
                    </Badge>
                    {mod && (
                      <Button asChild size="sm" variant="ghost" className="shrink-0">
                        <Link href={`/learn/${mod.slug}/quiz/result?attempt=${a.id}`}>View</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {visible.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No modules are available for your role yet. Check back later.
        </div>
      )}
    </div>
  );
}
