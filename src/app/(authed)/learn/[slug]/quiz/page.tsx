import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Button } from '@/components/ui/button';
import { QuizRunner } from '@/components/learn/quiz-runner';
import { ShareButton } from '@/components/learn/share-button';

export const dynamic = 'force-dynamic';

export default async function QuizStartPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { attempt?: string };
}) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/learn/${params.slug}/quiz`);

  const learningModule = await prisma.learningModule.findUnique({
    where: { slug: params.slug },
    include: {
      quiz: {
        include: {
          questions: {
            include: { options: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (!learningModule || !learningModule.isPublished) notFound();
  if (!learningModule.quiz) notFound();

  // Verify all lessons done
  const lessonIds = (
    await prisma.learningLesson.findMany({
      where: { moduleId: learningModule.id },
      select: { id: true },
    })
  ).map((l) => l.id);

  const completed = await prisma.lessonProgress.findMany({
    where: { userId: user.id, lessonId: { in: lessonIds } },
    select: { lessonId: true },
  });
  const allLessonsDone = lessonIds.length > 0 && completed.length === lessonIds.length;
  if (!allLessonsDone) {
    redirect(`/learn/${params.slug}`);
  }

  const questions = learningModule.quiz.questions.map((q) => ({
    id: q.id,
    order: q.order,
    prompt: q.prompt,
    type: q.type as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT',
  }));

  const options = learningModule.quiz.questions.flatMap((q) =>
    q.options.map((o) => ({
      id: o.id,
      questionId: o.questionId,
      text: o.text,
      order: o.order,
    }))
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-28 md:pb-0">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 h-9 text-muted-foreground">
          <Link href={`/learn/${params.slug}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {learningModule.title}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-navy-50 px-2.5 py-0.5 font-semibold text-navy-700">
            <ListChecks className="h-3 w-3" />
            Quiz
          </span>
          <span>{questions.length} questions</span>
          <span aria-hidden="true">·</span>
          <span>{learningModule.quiz.passingScore}% to pass</span>
        </div>

        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {learningModule.quiz.title}
        </h1>
      </header>

      <ShareButton
        path={`/share/learn/${learningModule.slug}/quiz`}
        title={learningModule.quiz.title}
        label="Share quiz"
      />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">How the quiz works</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One question at a time. Select your answer and press <strong className="text-foreground">Next</strong>.
          You can change your selection before submitting. The quiz is graded the moment you submit, and you
          can retake it if you do not pass.
        </p>
      </section>

      <QuizRunner
        quizId={learningModule.quiz.id}
        moduleSlug={params.slug}
        questions={questions}
        options={options}
        existingAttemptId={searchParams.attempt ?? null}
      />
    </div>
  );
}
