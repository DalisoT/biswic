import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, ListChecks } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { renderMarkdown } from '@/lib/utils-markdown';

export const dynamic = 'force-dynamic';

function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

export default async function LearnModulePage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getUser();

  const module = await prisma.learningModule.findUnique({
    where: { slug: params.slug },
    include: {
      lessons: { orderBy: { order: 'asc' } },
      quiz: { select: { id: true, passingScore: true } },
    },
  });

  if (!module || !module.isPublished) notFound();
  if (
    !isAudienceMatch(module.audience, user?.role ?? 'MEMBER', user?.isAdmin ?? false)
  ) {
    notFound();
  }

  // Per-user progress
  let completedLessonIds = new Set<string>();
  let bestQuizScore: number | null = null;
  let bestQuizPassed: boolean | null = null;
  if (user) {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: user.id, lessonId: { in: module.lessons.map((l) => l.id) } },
      select: { lessonId: true },
    });
    completedLessonIds = new Set(progress.map((p) => p.lessonId));
    if (module.quiz) {
      const completed = await prisma.quizAttempt.findMany({
        where: { userId: user.id, quizId: module.quiz.id, completedAt: { not: null } },
        select: { score: true, passed: true },
      });
      if (completed.length > 0) {
        const best = completed.reduce((acc, cur) => (cur.score > acc.score ? cur : acc));
        bestQuizScore = best.score;
        bestQuizPassed = best.passed;
      }
    }
  }

  const totalLessons = module.lessons.length;
  const completedCount = module.lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const allLessonsDone = completedCount === totalLessons && totalLessons > 0;
  const totalMinutes = module.lessons.reduce((sum, l) => sum + l.estimatedMin, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
            <Link href="/learn">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All modules
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant="secondary" className="mb-2">
                <GraduationCap className="h-3 w-3 mr-1" />
                Module {module.order}
              </Badge>
              <h1 className="text-3xl font-bold font-heading">{module.title}</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">{module.summary}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" /> {totalLessons} lessons
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> ~{totalMinutes} min
                </span>
                {module.quiz && (
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-4 w-4" /> {module.quiz.passingScore}% to pass
                  </span>
                )}
              </div>
            </div>
            {user && totalLessons > 0 && (
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold">
                  {Math.round((completedCount / totalLessons) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {completedCount}/{totalLessons} lessons
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Module summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About this module</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm sm:prose-base max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(module.content) }}
            />
          </CardContent>
        </Card>

        {/* Lessons list */}
        <section>
          <h2 className="text-xl font-semibold font-heading mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Lessons
          </h2>
          <ol className="space-y-3">
            {module.lessons.map((lesson, idx) => {
              const completed = completedLessonIds.has(lesson.id);
              const next = module.lessons[idx + 1];
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/learn/${module.slug}/${lesson.id}`}
                    className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:border-emerald-300 hover:shadow-sm transition-all"
                  >
                    <div
                      className={
                        'shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ' +
                        (completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-muted text-muted-foreground')
                      }
                    >
                      {completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">~{lesson.estimatedMin} min</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Quiz CTA */}
        {module.quiz && (
          <section>
            <Card className="bg-emerald-50/60 border-emerald-200">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5" /> End-of-module quiz
                    </CardTitle>
                    <CardDescription>
                      {module.quiz.passingScore}% to pass. You can retake as many times as you need.
                      {bestQuizScore !== null && (
                        <>
                          {' '}
                          Best score so far:{' '}
                          <span className={bestQuizPassed ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                            {bestQuizScore}%
                          </span>
                          {bestQuizPassed ? ' (passed)' : ' (try again)'}
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <p className="text-sm text-muted-foreground">
                    Sign in to take the quiz.
                  </p>
                ) : !allLessonsDone ? (
                  <p className="text-sm text-muted-foreground">
                    Complete all {totalLessons} lessons first to unlock the quiz.
                  </p>
                ) : (
                  <Button asChild>
                    <Link href={`/learn/${module.slug}/quiz`}>
                      {bestQuizScore === null ? 'Start quiz' : 'Retake quiz'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
