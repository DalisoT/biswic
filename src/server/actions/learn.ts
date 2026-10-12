'use server';

/**
 * Learning + Quiz server actions.
 * ----------------------------------------------------------------------------
 * Powers /learn routes. Mark a lesson complete, start a quiz attempt,
 * submit answers, grade. Idempotent where it makes sense.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { createNotification } from '@/server/actions/notifications';

// ----------------------------------------------------------------------------
// Lesson progress
// ----------------------------------------------------------------------------

const lessonIdSchema = z.object({ lessonId: z.string().uuid() });

export async function markLessonCompleteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = lessonIdSchema.safeParse({ lessonId: formData.get('lessonId') });
  if (!parsed.success) return { error: 'Invalid lesson id' };

  // Verify the lesson exists and user is allowed (basic role check via audience)
  const lesson = await prisma.learningLesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: {
      module: { select: { id: true, slug: true, title: true, audience: true, isPublished: true } },
    },
  });
  if (!lesson || !lesson.module.isPublished) {
    return { error: 'Lesson not found' };
  }
  if (
    lesson.module.audience.length > 0 &&
    !lesson.module.audience.includes(user.role as never) &&
    !user.isAdmin
  ) {
    return { error: 'Your role cannot access this module' };
  }

  await prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: { userId: user.id, lessonId: parsed.data.lessonId },
    },
    create: { userId: user.id, lessonId: parsed.data.lessonId },
    update: { completedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.LESSON_COMPLETED,
    entity: 'LearningLesson',
    entityId: parsed.data.lessonId,
    notes: `Completed "${lesson.title}" in module ${lesson.module.title}`,
  });

  revalidatePath(`/learn/${lesson.module.slug}`);
  return { success: true };
}

// ----------------------------------------------------------------------------
// Quiz attempts
// ----------------------------------------------------------------------------

const startAttemptSchema = z.object({ quizId: z.string().uuid() });

/**
 * Start (or resume) a quiz attempt. Returns the attempt id.
 * If the user already has an in-progress attempt, returns that one.
 * Otherwise creates a new one.
 */
export async function startQuizAttemptAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startAttemptSchema.safeParse({ quizId: formData.get('quizId') });
  if (!parsed.success) return { error: 'Invalid quiz id' };

  // Verify quiz exists and module is published + accessible
  const quiz = await prisma.quiz.findUnique({
    where: { id: parsed.data.quizId },
    include: { module: { select: { id: true, slug: true, title: true, audience: true, isPublished: true } } },
  });
  if (!quiz || !quiz.module.isPublished) {
    return { error: 'Quiz not found' };
  }
  if (
    quiz.module.audience.length > 0 &&
    !quiz.module.audience.includes(user.role as never) &&
    !user.isAdmin
  ) {
    return { error: 'Your role cannot access this quiz' };
  }

  // Find an in-progress attempt
  const existing = await prisma.quizAttempt.findFirst({
    where: { userId: user.id, quizId: quiz.id, completedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (existing) {
    return { success: true, attemptId: existing.id };
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId: user.id,
      quizId: quiz.id,
      score: 0,
      passed: false,
    },
  });

  revalidatePath(`/learn/${quiz.module.slug}/quiz`);
  return { success: true, attemptId: attempt.id };
}

const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.string(), // JSON-encoded { questionId: optionIds[] }
});

export async function submitQuizAttemptAction(formData: FormData) {
  const user = await requireUser();
  const parsed = submitAttemptSchema.safeParse({
    attemptId: formData.get('attemptId'),
    answers: formData.get('answers'),
  });
  if (!parsed.success) return { error: 'Invalid submission' };

  // Decode answers: { [questionId]: optionIds[] }
  let rawAnswers: Record<string, string[]>;
  try {
    rawAnswers = JSON.parse(parsed.data.answers);
  } catch {
    return { error: 'Malformed answers payload' };
  }

  // Load the attempt and its quiz
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: parsed.data.attemptId },
    include: {
      quiz: {
        include: {
          module: { select: { slug: true, title: true, id: true } },
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });
  if (!attempt || attempt.userId !== user.id) {
    return { error: 'Attempt not found' };
  }
  if (attempt.completedAt) {
    return { error: 'This attempt has already been submitted.' };
  }

  // Grade
  const totalQuestions = attempt.quiz.questions.length;
  let correctCount = 0;
  const gradedAnswers: {
    questionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean;
  }[] = [];

  for (const q of attempt.quiz.questions) {
    const selectedIds = rawAnswers[q.id] ?? [];
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);

    let isCorrect = false;
    if (q.type === 'MULTI_SELECT') {
      // Exact set match (same options selected, no extras, no missing)
      isCorrect =
        selectedIds.length === correctIds.length &&
        selectedIds.every((id) => correctIds.includes(id));
    } else {
      // SINGLE-ANSWER (MULTIPLE_CHOICE or TRUE_FALSE): exactly one correct option must be picked
      isCorrect = selectedIds.length === 1 && correctIds.includes(selectedIds[0]!);
    }

    if (isCorrect) correctCount++;
    gradedAnswers.push({
      questionId: q.id,
      selectedOptionIds: selectedIds,
      isCorrect,
    });
  }

  const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= attempt.quiz.passingScore;

  // Persist
  await prisma.$transaction([
    prisma.quizAnswer.createMany({
      data: gradedAnswers.map((a) => ({
        attemptId: attempt.id,
        questionId: a.questionId,
        selectedOptionIds: a.selectedOptionIds,
        isCorrect: a.isCorrect,
      })),
    }),
    prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { score, passed, completedAt: new Date() },
    }),
  ]);

  // Audit
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.QUIZ_ATTEMPT,
    entity: 'QuizAttempt',
    entityId: attempt.id,
    notes: `Quiz ${attempt.quiz.title} score=${score} passed=${passed}`,
  });

  // Live notification: tell the user they passed
  if (passed) {
    await createNotification({
      userId: user.id,
      type: 'INFO',
      title: '🎉 Quiz passed!',
      body: `You scored ${score}% on "${attempt.quiz.module.title}" (passing score: ${attempt.quiz.passingScore}%).`,
      link: `/learn/${attempt.quiz.module.slug}/quiz/result?attempt=${attempt.id}`,
    }).catch((err) => console.error('[notify] quiz-passed failed:', err));
  } else {
    await createNotification({
      userId: user.id,
      type: 'INFO',
      title: 'Quiz not passed yet',
      body: `You scored ${score}% on "${attempt.quiz.module.title}". Try again — passing score is ${attempt.quiz.passingScore}%.`,
      link: `/learn/${attempt.quiz.module.slug}/quiz`,
    }).catch((err) => console.error('[notify] quiz-failed failed:', err));
  }

  revalidatePath(`/learn/${attempt.quiz.module.slug}`);
  revalidatePath(`/learn/${attempt.quiz.module.slug}/quiz`);
  revalidatePath(`/learn/${attempt.quiz.module.slug}/quiz/result`);
  revalidatePath('/learn/me');
  revalidatePath('/notifications');
  return { success: true, score, passed, attemptId: attempt.id };
}

// ----------------------------------------------------------------------------
// Admin: publish a module
// ----------------------------------------------------------------------------

const publishSchema = z.object({ moduleId: z.string().uuid() });

export async function publishLearningModuleAction(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin && !['CHAIRPERSON', 'SECRETARY'].includes(user.role)) {
    return { error: 'Only admins or Secretary can publish a module.' };
  }
  const parsed = publishSchema.safeParse({ moduleId: formData.get('moduleId') });
  if (!parsed.success) return { error: 'Invalid module id' };
  const updated = await prisma.learningModule.update({
    where: { id: parsed.data.moduleId },
    data: { isPublished: true },
  });
  revalidatePath('/learn');
  revalidatePath(`/learn/${updated.slug}`);
  return { success: true };
}
