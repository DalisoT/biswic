import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function QuizResultPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { attempt?: string };
}) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/learn/${params.slug}/quiz/result`);

  const attemptId = searchParams.attempt;
  if (!attemptId) redirect(`/learn/${params.slug}`);

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          module: { select: { slug: true, title: true } },
          questions: {
            include: { options: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt || attempt.userId !== user.id) notFound();
  if (attempt.quiz.module.slug !== params.slug) notFound();
  if (!attempt.completedAt) redirect(`/learn/${params.slug}/quiz?attempt=${attempt.id}`);

  const totalQuestions = attempt.quiz.questions.length;
  const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
  const passed = attempt.passed;
  const required = attempt.quiz.passingScore;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
            <Link href={`/learn/${attempt.quiz.module.slug}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {attempt.quiz.module.title}
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">Quiz result</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Big result */}
        <Card className={passed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}>
          <CardContent className="p-8 text-center">
            {passed ? (
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-2" />
            ) : (
              <X className="h-12 w-12 mx-auto text-amber-600 mb-2" />
            )}
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {passed ? 'Passed' : 'Not passed'}
            </p>
            <p className="text-5xl font-bold mt-1">{attempt.score}%</p>
            <p className="text-sm text-muted-foreground mt-2">
              {correctCount} of {totalQuestions} correct · passing score is {required}%
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
              <Button asChild>
                <Link href={`/learn/${attempt.quiz.module.slug}/quiz`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {passed ? 'Retake quiz' : 'Try again'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/learn/me">
                  View my progress
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Per-question review */}
        <Card>
          <CardHeader>
            <CardTitle>Question-by-question</CardTitle>
            <CardDescription>Review your answers and learn from each one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {attempt.quiz.questions.map((q, idx) => {
              const myAnswerIds = attempt.answers.find((a) => a.questionId === q.id)?.selectedOptionIds ?? [];
              const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
              const myAnswerOk = attempt.answers.find((a) => a.questionId === q.id)?.isCorrect ?? false;
              return (
                <div
                  key={q.id}
                  className={
                    'p-4 rounded-lg border ' +
                    (myAnswerOk ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30')
                  }
                >
                  <div className="flex items-start gap-2 mb-2">
                    {myAnswerOk ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Question {idx + 1}</p>
                      <p className="font-medium">{q.prompt}</p>
                    </div>
                    <Badge variant={myAnswerOk ? 'default' : 'destructive'} className="shrink-0">
                      {myAnswerOk ? 'Correct' : 'Wrong'}
                    </Badge>
                  </div>

                  <ul className="space-y-1 mt-3">
                    {q.options.map((o) => {
                      const picked = myAnswerIds.includes(o.id);
                      const correct = o.isCorrect;
                      return (
                        <li
                          key={o.id}
                          className={
                            'flex items-center gap-2 text-sm px-2 py-1 rounded ' +
                            (correct
                              ? 'bg-emerald-100 text-emerald-900 font-medium'
                              : picked
                              ? 'bg-amber-100 text-amber-900 line-through'
                              : 'text-muted-foreground')
                          }
                        >
                          {correct ? (
                            <Check className="h-3 w-3" />
                          ) : picked ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <span className="h-3 w-3" />
                          )}
                          <span className="flex-1">{o.text}</span>
                          {picked && !correct && <span className="text-xs">Your pick</span>}
                          {correct && <span className="text-xs">Correct answer</span>}
                        </li>
                      );
                    })}
                  </ul>

                  {q.explanation && (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/learn/${attempt.quiz.module.slug}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to module
            </Link>
          </Button>
          <Button asChild>
            <Link href="/learn">More modules</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
