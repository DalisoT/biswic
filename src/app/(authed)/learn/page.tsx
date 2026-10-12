import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, Sparkles } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Financial Literacy Hub · BISWIC',
  description:
    'Self-paced learning for BISWIC members. Cooperative basics, soft loans, welfare claims, AGM prep — with quizzes to verify understanding.',
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 text-emerald-700 rounded-lg p-2">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading">Financial Literacy Hub</h1>
              <p className="text-sm text-muted-foreground">
                Learn the cooperative. Pass the quizzes. Become a better member.
              </p>
            </div>
          </div>
          {user ? (
            <Button asChild variant="outline">
              <Link href="/learn/me">
                My progress
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in to track progress</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero summary */}
        <section className="mb-10">
          <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0">
            <CardContent className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-emerald-100 text-sm uppercase tracking-wider font-medium">
                    Available to all members
                  </p>
                  <h2 className="text-3xl font-bold font-heading mt-1">
                    {visible.length} modules · {totalLessons} lessons
                  </h2>
                  <p className="text-emerald-100 mt-2 max-w-xl">
                    From soft-loan math to AGM prep, this hub covers what every BISWIC member needs to know.
                    Each module ends with a short quiz.
                  </p>
                </div>
                {user && totalLessons > 0 && (
                  <div className="text-right">
                    <p className="text-4xl font-bold">
                      {Math.round((completedLessons / totalLessons) * 100)}%
                    </p>
                    <p className="text-emerald-100 text-sm">complete</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Module grid */}
        <section>
          <h2 className="text-xl font-semibold font-heading mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((m) => {
              const lessonIds = m.lessons.map((l) => l.id);
              const progress = user ? progressFor(progresses, lessonIds) : 0;
              const quizBest = user && m.quiz
                ? bestQuizScore(attempts.filter((a) => a.quizId === m.quiz!.id))
                : { score: null, passed: null };
              return (
                <Link
                  key={m.id}
                  href={`/learn/${m.slug}`}
                  className="group block focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                >
                  <Card className="h-full transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg group-hover:text-emerald-700 transition-colors">
                          {m.title}
                        </CardTitle>
                        {m.quiz && quizBest.passed === true && (
                          <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Passed
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">{m.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{m.lessons.length} lessons</span>
                        {m.quiz && <span>· quiz ({m.quiz.passingScore}% to pass)</span>}
                      </div>
                      {user && progress > 0 && (
                        <div className="mt-3">
                          <div className="h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
                        </div>
                      )}
                      {m.quiz && quizBest.score !== null && (
                        <p className="text-xs mt-2">
                          <span
                            className={
                              quizBest.passed
                                ? 'text-emerald-700 font-medium'
                                : 'text-amber-700 font-medium'
                            }
                          >
                            Best score: {quizBest.score}%
                          </span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* CTA for non-logged-in users */}
        {!user && (
          <section className="mt-10 text-center">
            <Card className="bg-muted/50">
              <CardContent className="p-8">
                <Sparkles className="h-8 w-8 mx-auto text-emerald-600 mb-3" />
                <h3 className="text-lg font-semibold mb-1">Track your progress</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Sign in to mark lessons complete, take quizzes, and see your overall literacy progress
                  on the dashboard.
                </p>
                <Button asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
