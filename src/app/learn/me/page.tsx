import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BookOpen, CheckCircle2, ListChecks, XCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold font-heading">My learning</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your progress through the cooperative&apos;s financial literacy modules.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Stat cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Modules started</p>
              <p className="text-2xl font-bold mt-1">
                {modulesStarted}
                <span className="text-sm font-normal text-muted-foreground">/{visible.length}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Modules completed</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">{modulesCompleted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Lessons done</p>
              <p className="text-2xl font-bold mt-1">
                {lessonsDone}
                <span className="text-sm font-normal text-muted-foreground">/{totalLessons}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Quizzes passed</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">{quizzesPassed}</p>
            </CardContent>
          </Card>
        </section>

        {/* Module list with progress */}
        <section>
          <h2 className="text-xl font-semibold font-heading mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Modules
          </h2>
          <div className="space-y-3">
            {visible.map((m) => {
              const lessonIds = m.lessons.map((l) => l.id);
              const done = lessonIds.filter((id) => completedLessonSet.has(id)).length;
              const total = lessonIds.length;
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;
              const completed = total > 0 && done === total;
              const bestAttempt = m.quiz
                ? allAttempts.filter((a) => a.quizId === m.quiz!.id && a.completedAt).reduce<
                    null | { score: number; passed: boolean; completedAt: Date }
                  >((acc, cur) => (!acc || cur.score > acc.score ? cur : acc), null)
                : null;
              return (
                <Card key={m.id} className={completed ? 'border-emerald-200' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          {completed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {m.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-1">{m.summary}</CardDescription>
                      </div>
                      {m.quiz && bestAttempt && (
                        <Badge variant={bestAttempt.passed ? 'default' : 'destructive'}>
                          Best: {bestAttempt.score}%
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {done}/{total} lessons
                      </span>
                      <span>·</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <Button asChild size="sm" variant={completed ? 'outline' : 'default'}>
                      <Link href={`/learn/${m.slug}`}>
                        {done === 0 ? 'Start' : done < total ? 'Continue' : 'Review'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Recent activity */}
        {recentAttempts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold font-heading mb-4 flex items-center gap-2">
              <ListChecks className="h-5 w-5" /> Recent quiz attempts
            </h2>
            <Card>
              <CardContent className="p-0">
                <ul>
                  {recentAttempts.map((a) => {
                    const mod = visible.find((m) => m.quiz?.id === a.quizId);
                    return (
                      <li key={a.id} className="p-4 border-b last:border-0 flex items-center gap-3">
                        {a.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {mod?.title ?? 'Unknown module'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.completedAt?.toLocaleString() ?? 'in progress'}
                          </p>
                        </div>
                        <Badge variant={a.passed ? 'default' : 'destructive'}>{a.score}%</Badge>
                        {mod && (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/learn/${mod.slug}/quiz/result?attempt=${a.id}`}>View</Link>
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}

        {visible.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No modules are available for your role yet. Check back later.
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
