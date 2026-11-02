import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { GuestQuiz } from '@/components/learn/guest-quiz';
import { QuizRunner } from '@/components/learn/quiz-runner';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string } };

async function loadQuiz(slug: string) {
  const learningModule = await prisma.learningModule.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      audience: true,
      isPublished: true,
      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          questions: {
            select: {
              id: true,
              order: true,
              prompt: true,
              type: true,
              explanation: true,
              options: {
                select: { id: true, questionId: true, text: true, order: true, isCorrect: true },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (!learningModule || !learningModule.isPublished || !learningModule.quiz) return null;
  return learningModule;
}

/**
 * A shared module is only shareable if its audience includes MEMBER. Every
 * module published today lists every role, so all of them are shareable; a
 * module later restricted to officers alone is not, and its shared URL 404s.
 */
function isShareable(audience: string[]): boolean {
  return audience.length === 0 || audience.includes('MEMBER');
}

/** The signed-in member's own rule for reaching a module. */
function audienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const learningModule = await loadQuiz(params.slug);
  if (!learningModule) return { title: 'Quiz not found', robots: { index: false } };

  const title = `${learningModule.quiz!.title} — ${learningModule.title}`;
  return {
    title,
    description: learningModule.summary,
    robots: { index: false, follow: false },
    openGraph: { title, description: learningModule.summary, type: 'article' },
  };
}

export default async function SharedQuizPage({ params }: Props) {
  const learningModule = await loadQuiz(params.slug);
  if (!learningModule) notFound();
  if (!isShareable(learningModule.audience)) notFound();

  const quiz = learningModule.quiz!;
  const user = await getUser();

  const questions = quiz.questions.map((q) => ({
    id: q.id,
    order: q.order,
    prompt: q.prompt,
    type: q.type as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT',
    explanation: q.explanation,
  }));

  const options = quiz.questions.flatMap((q) =>
    q.options.map((o) => ({
      id: o.id,
      questionId: o.questionId,
      text: o.text,
      order: o.order,
      isCorrect: o.isCorrect,
    })),
  );

  // A signed-in member whose own role may not open this module in the hub
  // still gets a usable quiz -- graded in the browser rather than stored,
  // because the server would refuse to create the attempt.
  const canRecord = !!user && audienceMatch(learningModule.audience, user.role, user.isAdmin);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">{learningModule.title}</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">
          {questions.length} questions · {quiz.passingScore}% to pass
        </p>
      </header>

      {canRecord ? (
        <>
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            You are signed in, so this attempt is recorded against your account.
          </p>
          <QuizRunner
            quizId={quiz.id}
            moduleSlug={learningModule.slug}
            questions={questions.map(({ explanation: _explanation, ...q }) => q)}
            options={options.map(({ isCorrect: _isCorrect, ...o }) => o)}
            existingAttemptId={null}
          />
        </>
      ) : (
        <GuestQuiz questions={questions} options={options} passingScore={quiz.passingScore} />
      )}
    </div>
  );
}
