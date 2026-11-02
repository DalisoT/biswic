/**
 * Matching rules for a learning content bundle.
 * ---------------------------------------------------------------------------
 * A bundle says what the lessons SHOULD say. This module decides, for each
 * module and lesson in the bundle, whether it would be created, updated, or
 * left exactly as it is.
 *
 * Two rules are absolute:
 *
 *   1. NOTHING IS EVER DELETED. There is no delete path in this file, and
 *      `planLearningImport` never reports one. `LessonProgress.lesson` and
 *      `QuizAttempt.quiz` both cascade on delete, so deleting a lesson would
 *      wipe every member's record of which lessons they have completed, and
 *      deleting a quiz would wipe every member's scores. A lesson the bundle
 *      simply does not mention stays untouched.
 *
 *   2. LESSONS ARE MATCHED BY ORDER, WITHIN A MODULE MATCHED BY SLUG. The
 *      bundle therefore carries both, and the two together identify a lesson
 *      exactly.
 */

export interface BundleLesson {
  order: number;
  title: string;
  content: string;
  estimatedMin: number;
}

export interface BundleQuestion {
  order: number;
  prompt: string;
  type: string;
  explanation?: string | null;
  options: { text: string; correct: boolean; order: number }[];
}

export interface BundleQuiz {
  title: string;
  passingScore: number;
  questions: BundleQuestion[];
}

export interface BundleModule {
  slug: string;
  title: string;
  summary: string;
  content?: string;
  audience: string[];
  order: number;
  isPublished: boolean;
  lessons: BundleLesson[];
  quiz?: BundleQuiz | null;
}

export interface LearningBundle {
  modules: BundleModule[];
}

export type LessonPlan =
  | { action: 'create'; order: number; title: string }
  | { action: 'update'; order: number; title: string };

export type ModulePlan = {
  action: 'create' | 'update';
  slug: string;
  lessons: LessonPlan[];
  /** `create` only when the module has no quiz and the bundle brings one. */
  quizAction: 'create' | 'skip';
};

export interface ImportTotals {
  modulesCreated: number;
  modulesUpdated: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  /** Always 0. It exists so the dry-run summary can say so out loud. */
  deleted: number;
}

export interface CurrentModule {
  slug: string;
  lessonOrders: number[];
  hasQuiz: boolean;
}

/**
 * Work out what applying a bundle would do.
 *
 * Pure: it reads a description of the current modules and returns a plan. It
 * never touches a database, so the admin panel can show the chairman exactly
 * what will happen before anything is written.
 */
export function planLearningImport(
  current: CurrentModule[],
  bundle: LearningBundle,
): { modules: ModulePlan[]; totals: ImportTotals } {
  const currentBySlug = new Map(current.map((m) => [m.slug, m]));

  const modules: ModulePlan[] = bundle.modules.map((bm) => {
    const existing = currentBySlug.get(bm.slug);
    const existingOrders = new Set(existing?.lessonOrders ?? []);

    const lessons: LessonPlan[] = bm.lessons.map((bl) => ({
      action: existingOrders.has(bl.order) ? ('update' as const) : ('create' as const),
      order: bl.order,
      title: bl.title,
    }));

    // A quiz is only created when the bundle brings one AND the module has
    // no quiz yet. A module that does not exist yet obviously has no quiz, so
    // a brand new module brings its quiz with it. An existing quiz is never
    // replaced: that would clear every member's stored answers for it.
    const quizAction: 'create' | 'skip' =
      bm.quiz && (!existing || !existing.hasQuiz) ? 'create' : 'skip';

    return {
      action: existing ? ('update' as const) : ('create' as const),
      slug: bm.slug,
      lessons,
      quizAction,
    };
  });

  const totals: ImportTotals = {
    modulesCreated: modules.filter((m) => m.action === 'create').length,
    modulesUpdated: modules.filter((m) => m.action === 'update').length,
    lessonsCreated: modules.reduce(
      (n, m) => n + m.lessons.filter((l) => l.action === 'create').length,
      0,
    ),
    lessonsUpdated: modules.reduce(
      (n, m) => n + m.lessons.filter((l) => l.action === 'update').length,
      0,
    ),
    deleted: 0,
  };

  return { modules, totals };
}

/** Parse a bundle from JSON text, with an error a human can act on. */
export function parseBundle(
  text: string,
): { ok: true; bundle: LearningBundle } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `That is not valid JSON: ${(err as Error).message}` };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'A bundle must be a JSON object.' };
  }

  const modules = (parsed as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) {
    return { ok: false, error: 'A bundle must have a "modules" array.' };
  }

  for (const [i, m] of modules.entries()) {
    if (typeof m !== 'object' || m === null || Array.isArray(m)) {
      return { ok: false, error: `Module ${i + 1} is not an object.` };
    }
    const mod = m as Partial<BundleModule>;
    if (typeof mod.slug !== 'string' || mod.slug.length === 0) {
      return { ok: false, error: `Module ${i + 1} has no "slug".` };
    }
    if (typeof mod.title !== 'string' || mod.title.length === 0) {
      return { ok: false, error: `Module "${mod.slug}" has no "title".` };
    }
    if (!Array.isArray(mod.lessons)) {
      return { ok: false, error: `Module "${mod.slug}" has no "lessons" array.` };
    }
    for (const [j, l] of mod.lessons.entries()) {
      if (typeof l !== 'object' || l === null) {
        return { ok: false, error: `Lesson ${j + 1} of "${mod.slug}" is not an object.` };
      }
      const lesson = l as Partial<BundleLesson>;
      if (typeof lesson.order !== 'number') {
        return {
          ok: false,
          error: `Lesson ${j + 1} of "${mod.slug}" has no numeric "order".`,
        };
      }
      if (typeof lesson.title !== 'string' || lesson.title.length === 0) {
        return { ok: false, error: `Lesson ${lesson.order} of "${mod.slug}" has no "title".` };
      }
      if (typeof lesson.content !== 'string' || lesson.content.length === 0) {
        return { ok: false, error: `Lesson ${lesson.order} of "${mod.slug}" has no "content".` };
      }
    }
  }

  return { ok: true, bundle: parsed as LearningBundle };
}
