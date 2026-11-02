'use server';

/**
 * Admin actions for the Learning Hub editor.
 * ---------------------------------------------------------------------------
 * Two things live here:
 *
 *   1. Editing one lesson in place.
 *   2. Applying a content bundle -- a set of modules, lessons and quizzes.
 *
 * THE ONE RULE THAT SHAPES BOTH: nothing is ever deleted.
 *
 * `LessonProgress.lesson` and `QuizAttempt.quiz` both cascade on delete, so
 * deleting a lesson would wipe every member's record of which lessons they
 * have completed, and deleting a quiz would wipe every member's scores. A
 * lesson the bundle does not mention stays exactly as it is, and an existing
 * quiz is never replaced.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { QuizQuestionType, Role } from '@prisma/client';
import type { BundleModule } from '@/lib/learning-import';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { parseBundle, planLearningImport } from '@/lib/learning-import';

const OFFICER_ROLES = [
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'SECRETARY',
  'TREASURER',
  'DEPUTY_TREASURER',
  'FW',
  'CCD',
];

/** Admins and officers may edit learning content. Everyone else is refused. */
async function requireLearningEditor() {
  const user = await requireUser();
  if (!user.isAdmin && !OFFICER_ROLES.includes(user.role)) return null;
  return user;
}

/**
 * The nested shape Prisma wants for a quiz and its questions.
 *
 * The bundle speaks in "correct"; the database speaks in "isCorrect".
 * A quiz is only ever CREATED, never replaced: replacing one would
 * clear every member's stored answers for it.
 */
function quizCreate(quiz: NonNullable<BundleModule['quiz']>) {
  return {
    title: quiz.title,
    passingScore: quiz.passingScore,
    questions: {
      create: quiz.questions.map((qn) => ({
        order: qn.order,
        prompt: qn.prompt,
        type: qn.type as QuizQuestionType,
        explanation: qn.explanation ?? null,
        options: {
          create: qn.options.map((o) => ({
            text: o.text,
            isCorrect: o.correct,
            order: o.order,
          })),
        },
      })),
    },
  };
}

const lessonSchema = z.object({
  lessonId: z.string().uuid(),
  title: z.string().min(1).max(200),
  estimatedMin: z.coerce.number().int().min(1).max(120),
  content: z.string().min(1),
});

/**
 * Edit one lesson in place. This is an UPDATE, never a delete, so every
 * member's LessonProgress row for that lesson survives.
 */
export async function updateLessonAction(formData: FormData) {
  const user = await requireLearningEditor();
  if (!user) return { error: 'Only admins or officers can edit lessons.' };

  const parsed = lessonSchema.safeParse({
    lessonId: formData.get('lessonId'),
    title: formData.get('title'),
    estimatedMin: formData.get('estimatedMin'),
    content: formData.get('content'),
  });
  if (!parsed.success) {
    return { error: 'Please check the lesson title, the minutes and the body.' };
  }

  const before = await prisma.learningLesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: { module: { select: { slug: true, title: true } } },
  });
  if (!before) return { error: 'Lesson not found.' };

  await prisma.learningLesson.update({
    where: { id: parsed.data.lessonId },
    data: {
      title: parsed.data.title,
      estimatedMin: parsed.data.estimatedMin,
      content: parsed.data.content,
    },
  });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'LearningLesson',
    entityId: before.id,
    notes: `Lesson "${before.title}" in ${before.module.title} edited to "${parsed.data.title}" (${before.content.length} -> ${parsed.data.content.length} characters)`,
  });

  revalidatePath(`/learn/${before.module.slug}`);
  revalidatePath(`/learn/${before.module.slug}/${before.id}`);
  revalidatePath('/learn');
  return { success: true };
}

const bundleSchema = z.object({ bundle: z.string().min(1) });

/**
 * Apply a content bundle.
 *
 * Modules are matched by slug and lessons by order. Nothing is ever deleted.
 */
export async function applyLearningBundleAction(formData: FormData) {
  const user = await requireLearningEditor();
  if (!user) return { error: 'Only admins or officers can apply a bundle.' };

  const parsed = bundleSchema.safeParse({ bundle: formData.get('bundle') });
  if (!parsed.success) return { error: 'No bundle was supplied.' };

  const result = parseBundle(parsed.data.bundle);
  if (!result.ok) return { error: result.error };
  const bundle = result.bundle;

  const current = await prisma.learningModule.findMany({
    select: {
      id: true,
      slug: true,
      quiz: { select: { id: true } },
      lessons: { select: { order: true } },
    },
  });

  const plan = planLearningImport(
    current.map((m) => ({
      slug: m.slug,
      lessonOrders: m.lessons.map((l) => l.order),
      hasQuiz: !!m.quiz,
    })),
    bundle,
  );

  for (const bm of bundle.modules) {
    const existing = current.find((m) => m.slug === bm.slug);

    // A quiz is created only when the bundle brings one and the module
    // has none: a brand new module obviously has none, and a module that
    // was created without its quiz is given one.
    const wantQuiz = !!bm.quiz && (!existing || existing.quiz === null);

    if (!existing) {
      // A brand new module, with its lessons and its quiz created alongside it.
      await prisma.learningModule.create({
        data: {
          slug: bm.slug,
          title: bm.title,
          summary: bm.summary,
          content: bm.content ?? bm.summary,
          audience: bm.audience as Role[],
          isPublished: bm.isPublished,
          order: bm.order,
          lessons: {
            create: bm.lessons.map((l) => ({
              order: l.order,
              title: l.title,
              content: l.content,
              estimatedMin: l.estimatedMin,
            })),
          },
          ...(wantQuiz ? { quiz: { create: quizCreate(bm.quiz!) } } : {}),
        },
      });
      continue;
    }

    await prisma.learningModule.update({
      where: { slug: bm.slug },
      data: {
        title: bm.title,
        summary: bm.summary,
        ...(bm.content ? { content: bm.content } : {}),
        audience: bm.audience as Role[],
        isPublished: bm.isPublished,
        order: bm.order,
      },
    });

    for (const bl of bm.lessons) {
      // Match by order. Updating in place keeps the lesson id, and therefore
      // every member's LessonProgress row for it.
      await prisma.learningLesson.upsert({
        where: { moduleId_order: { moduleId: existing.id, order: bl.order } },
        update: {
          title: bl.title,
          content: bl.content,
          estimatedMin: bl.estimatedMin,
        },
        create: {
          moduleId: existing.id,
          order: bl.order,
          title: bl.title,
          content: bl.content,
          estimatedMin: bl.estimatedMin,
        },
      });
    }

    // The module existed but had no quiz. Give it the one the bundle
    // carries, so every module in the hub ends with a quiz.
    if (wantQuiz) {
      await prisma.quiz.create({
        data: {
          moduleId: existing.id,
          ...quizCreate(bm.quiz!),
        },
      });
    }
  }

  const t = plan.totals;
  const summary = `${t.modulesCreated} modules created, ${t.modulesUpdated} updated, ${t.lessonsCreated} lessons created, ${t.lessonsUpdated} updated, ${t.deleted} deleted`;

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'LearningModule',
    entityId: bundle.modules[0]?.slug ?? 'bundle',
    notes: `Content bundle applied: ${summary}`,
  });

  revalidatePath('/learn');
  revalidatePath('/learn/me');
  for (const bm of bundle.modules) {
    revalidatePath(`/learn/${bm.slug}`);
  }

  return { success: true, summary };
}
