import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Button } from '@/components/ui/button';

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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 h-9 text-muted-foreground">
          <Link href={`/learn/${attempt.quiz.module.slug}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {attempt.quiz.module.title}
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Quiz result</h1>
      </header>

      {/* Score */}
      <section
        className={
          'rounded-lg border p-6 text-center ' +
          (passed ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60')
        }
      >
        {passed ? (
          <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-emerald-600" />
        ) : (
          <X className="mx-auto mb-2 h-12 w-12 text-amber-600" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {passed ? 'Passed' : 'Not passed'}
        </p>
        <p className="mt-1 font-heading text-5xl font-bold">{attempt.score}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {correctCount} of {totalQuestions} correct · passing score is {required}%
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
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
      </section>

      {/* Per-question review */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Question by question</h2>
        <div className="space-y-3">
          {attempt.quiz.questions.map((q, idx) => {
            const myAnswerIds =
              attempt.answers.find((a) => a.questionId === q.id)?.selectedOptionIds ?? [];
            const myAnswerOk = attempt.answers.find((a) => a.questionId === q.id)?.isCorrect ?? false;
            return (
              <article
                key={q.id}
                className={
                  'rounded-lg border p-4 ' +
                  (myAnswerOk
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-amber-200 bg-amber-50/30')
                }
              >
                <div className="mb-2 flex items-start gap-2">
                  {myAnswerOk ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <X className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Question {idx + 1}</p>
                    <p className="font-medium leading-snug">{q.prompt}</p>
                  </div>
                  <span
                    className={
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                      (myAnswerOk
                        ? 'bg-emerald-600 text-white'
                        : 'bg-destructive text-destructive-foreground')
                    }
                  >
                    {myAnswerOk ? 'Correct' : 'Wrong'}
                  </span>
                </div>

                <ul className="mt-3 space-y-1">
                  {q.options.map((o) => {
                    const picked = myAnswerIds.includes(o.id);
                    const correct = o.isCorrect;
                    return (
                      <li
                        key={o.id}
                        className={
                          'flex items-center gap-2 rounded px-2 py-1.5 text-sm ' +
                          (correct
                            ? 'bg-emerald-100 font-medium text-emerald-900'
                            : picked
                            ? 'bg-amber-100 text-amber-900 line-through'
                            : 'text-muted-foreground')
                        }
                      >
                        {correct ? (
                          <Check className="h-3.5 w-3.5 shrink-0" />
                        ) : picked ? (
                          <X className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">{o.text}</span>
                        {picked && !correct && <span className="shrink-0 text-xs">Your pick</span>}
                        {correct && <span className="shrink-0 text-xs">Correct answer</span>}
                      </li>
                    );
                  })}
                </ul>

                {q.explanation && (
                  <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                    {q.explanation}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
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
    </div>
  );
}
