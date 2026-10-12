import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, ListChecks } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QuizRunner } from '@/components/learn/quiz-runner';

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

  const module = await prisma.learningModule.findUnique({
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

  if (!module || !module.isPublished) notFound();
  if (!module.quiz) notFound();

  // Verify all lessons done
  const lessonIds = (
    await prisma.learningLesson.findMany({
      where: { moduleId: module.id },
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

  const questions = module.quiz.questions.map((q) => ({
    id: q.id,
    order: q.order,
    prompt: q.prompt,
    type: q.type as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT',
  }));

  const options = module.quiz.questions.flatMap((q) =>
    q.options.map((o) => ({
      id: o.id,
      questionId: o.questionId,
      text: o.text,
      order: o.order,
    }))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
            <Link href={`/learn/${params.slug}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {module.title}
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">
              <ListChecks className="h-3 w-3 mr-1" />
              Quiz
            </Badge>
            <span>·</span>
            <span>{questions.length} questions</span>
            <span>·</span>
            <span>{module.quiz.passingScore}% to pass</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading mt-2">{module.quiz.title}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>How the quiz works</CardTitle>
            <CardDescription>
              One question at a time. Select your answer and click <strong>Next</strong>. You can
              change your selection before submitting. Once you click <strong>Submit</strong> on
              the last question, the quiz is graded immediately and you can retake if you don't
              pass.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuizRunner
              quizId={module.quiz.id}
              moduleSlug={params.slug}
              questions={questions}
              options={options}
              existingAttemptId={searchParams.attempt ?? null}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
