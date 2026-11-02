# Learning Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member share any lesson or module quiz as a public link that opens without an account, let a visitor take that quiz and be scored in the browser, and give the chairman an in-app editor that rewrites the 17 existing lessons and adds 3 new modules without touching the database.

**Architecture:** A public `/share` route group sits outside the `(authed)` group so no layout auth gate applies. One pure grading module (`src/lib/quiz-grading.ts`) is the single implementation of the scoring rules, called by the existing server action and by the new guest mode, so the two can never drift. One pure import-matching module (`src/lib/learning-import.ts`) decides what a content bundle would create, update and leave alone, so the admin panel can show a dry-run summary before writing and can never delete.

**Tech Stack:** Next.js 14 App Router (React Server Components + server actions), TypeScript, Prisma, Supabase Auth, Zod, Vitest, Tailwind, shadcn/ui.

## Global Constraints

- **No schema migration.** `prisma migrate deploy` is not in the Vercel build script (`check:secrets && prisma generate && tsc --noEmit && vitest run && next build`), there is no `vercel.json`, and this machine has no `DATABASE_URL`. `prisma/schema.prisma` and every file under `prisma/migrations/` are **not changed**.
- **Never delete learning content.** `LessonProgress.lesson` is `onDelete: Cascade` and `QuizAttempt.quiz` is `onDelete: Cascade`, so a `deleteMany` on lessons or quizzes wipes every member's progress and scores. The import path contains **no delete of any kind**. A lesson the bundle omits stays exactly as it is.
- **Lessons are matched by `module.slug` + `lesson.order`.** Module count, lesson count per module, and every lesson's `order` are unchanged for the 17 existing lessons. They are rewritten **in place**, so lesson ids, `LessonProgress` rows and quiz attempt history all survive.
- **The ten existing quizzes are not touched.** Their questions, options, correct answers and pass marks stay byte-identical, so no member's score moves.
- **The guest answer key is visible to anyone with the link.** Inherent in "scored but not stored": grading without storing requires the correct answers in the browser. The member quiz stays server-graded and its key never leaves the server.
- **Shared pages are `noindex`.** `robots: { index: false }` plus an Open Graph description, so a WhatsApp preview renders but search engines do not index lesson content.
- **Windows line endings.** Every repo runs `core.autocrlf=true` with no `.gitattributes`, so the working tree is CRLF. Normalise every touched file with `python C:\Users\RICHARD_TEMBO\AppData\Local\Temp\fix-eol2.py <path>` and confirm with `check-eol.py` before committing.
- **One deploy.** Vercel builds sit in a queue of roughly an hour. Tasks 1–7 ship as **one commit**. Task 8 (content) is applied through the admin editor, which needs no deploy.

---

## File Structure

**New**

```
src/lib/quiz-grading.ts                     pure grading rules, used by server + guest
src/lib/learning-import.ts                  pure bundle -> create/update/leave-alone plan
src/components/learn/share-button.tsx       client: native share sheet or clipboard
src/components/learn/guest-quiz.tsx         client: browser-graded quiz with explanations
src/components/learn/admin-lesson-editor.tsx     client: edit one lesson
src/components/learn/admin-import-panel.tsx      client: paste/upload a bundle, dry-run
src/app/share/layout.tsx                    public shell (no member chrome)
src/app/share/learn/[slug]/[lessonId]/page.tsx   a shared lesson
src/app/share/learn/[slug]/quiz/page.tsx          a shared module quiz
src/app/(authed)/admin/learning/page.tsx          the admin learning editor
src/server/actions/learning-admin.ts        lesson update + bundle apply actions
tests/unit/quiz-grading.test.ts
tests/unit/learning-import.test.ts
docs/learning-bundles/*.json                the content bundles, versioned
```

**Modified**

```
src/server/actions/learn.ts                 grade via src/lib/quiz-grading.ts
src/components/learn/quiz-runner.tsx       guestMode prop
src/app/(authed)/learn/[slug]/[lessonId]/page.tsx   Share button
src/app/(authed)/learn/[slug]/quiz/page.tsx         Share button
src/components/layout/sidebar.tsx          admin learning link
```

**Not modified:** `prisma/schema.prisma`, `prisma/migrations/**`, the ten existing quizzes.

---

### Task 1: One grading implementation, shared by the server and the guest

The scoring rules already exist inline in `submitQuizAttemptAction`
(`src/server/actions/learn.ts:163-196`). They move into a pure module so the
guest path cannot drift from the member path.

**Files:**
- Create: `src/lib/quiz-grading.ts`
- Modify: `src/server/actions/learn.ts:163-196`
- Test: `tests/unit/quiz-grading.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type GradingQuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';
  export interface GradingOption { id: string; isCorrect: boolean; }
  export interface GradingQuestion {
    id: string;
    type: GradingQuestionType;
    correctOptionIds: string[];
  }
  export interface GradedAnswer {
    questionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean;
  }
  export interface QuizGrade {
    score: number;        // 0-100, rounded
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    answers: GradedAnswer[];
  }
  export function gradeQuiz(
    questions: GradingQuestion[],
    answers: Record<string, string[]>,
    passingScore: number,
  ): QuizGrade;
  export function isAnswerCorrect(
    type: GradingQuestionType,
    selectedOptionIds: string[],
    correctOptionIds: string[],
  ): boolean;
  ```

- [ ] **Step 1: Write the failing test** — `tests/unit/quiz-grading.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gradeQuiz, isAnswerCorrect } from '@/lib/quiz-grading';

describe('isAnswerCorrect', () => {
  it('accepts exactly one correct option for a single-answer question', () => {
    expect(isAnswerCorrect('MULTIPLE_CHOICE', ['a'], ['a'])).toBe(true);
  });
  it('rejects a single-answer question with two options selected', () => {
    expect(isAnswerCorrect('MULTIPLE_CHOICE', ['a', 'b'], ['a'])).toBe(false);
  });
  it('rejects a single-answer question with the wrong option', () => {
    expect(isAnswerCorrect('TRUE_FALSE', ['b'], ['a'])).toBe(false);
  });
  it('accepts a multi-select answered with the exact set', () => {
    expect(isAnswerCorrect('MULTI_SELECT', ['a', 'c'], ['a', 'c'])).toBe(true);
  });
  it('rejects a multi-select answered with an extra option', () => {
    expect(isAnswerCorrect('MULTI_SELECT', ['a', 'b', 'c'], ['a', 'c'])).toBe(false);
  });
  it('rejects a multi-select answered with a missing option', () => {
    expect(isAnswerCorrect('MULTI_SELECT', ['a'], ['a', 'c'])).toBe(false);
  });
});

describe('gradeQuiz', () => {
  const questions = [
    { id: 'q1', type: 'MULTIPLE_CHOICE' as const, correctOptionIds: ['a'] },
    { id: 'q2', type: 'TRUE_FALSE' as const, correctOptionIds: ['t'] },
    { id: 'q3', type: 'MULTI_SELECT' as const, correctOptionIds: ['x', 'y'] },
  ];

  it('scores 100 when every answer is right', () => {
    const g = gradeQuiz(questions, { q1: ['a'], q2: ['t'], q3: ['x', 'y'] }, 70);
    expect(g.score).toBe(100);
    expect(g.passed).toBe(true);
    expect(g.correctCount).toBe(3);
    expect(g.totalQuestions).toBe(3);
  });

  it('treats an unanswered question as wrong', () => {
    const g = gradeQuiz(questions, { q1: ['a'] }, 70);
    expect(g.correctCount).toBe(1);
    expect(g.score).toBe(33);
  });

  it('scores 0 when nothing is answered', () => {
    const g = gradeQuiz(questions, {}, 70);
    expect(g.score).toBe(0);
    expect(g.passed).toBe(false);
  });

  it('returns score 0 and passed false for a quiz with no questions', () => {
    const g = gradeQuiz([], { q1: ['a'] }, 70);
    expect(g.score).toBe(0);
    expect(g.passed).toBe(false);
    expect(g.totalQuestions).toBe(0);
  });

  it('passes exactly on the pass mark', () => {
    const g = gradeQuiz(questions, { q1: ['a'], q2: ['t'], q3: ['x'] }, 67);
    expect(g.score).toBe(67);
    expect(g.passed).toBe(true);
  });

  it('returns one graded answer per question, in question order', () => {
    const g = gradeQuiz(questions, { q1: ['a'] }, 70);
    expect(g.answers).toHaveLength(3);
    expect(g.answers.map((a) => a.questionId)).toEqual(['q1', 'q2', 'q3']);
    expect(g.answers[0].isCorrect).toBe(true);
    expect(g.answers[1].isCorrect).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules\.bin\vitest.cmd run tests/unit/quiz-grading.test.ts`
Expected: FAIL — "Cannot find module '@/lib/quiz-grading'".

- [ ] **Step 3: Write the implementation** — `src/lib/quiz-grading.ts`:

```ts
/**
 * Quiz grading rules, in one place.
 * ---------------------------------------------------------------------------
 * The member quiz grades on the server and the shared quiz grades in the
 * browser. If those two implementations ever differ, a member's score in the
 * hub would not match the score they get on their own shared link -- so both
 * call this module instead of carrying their own copy of the rules.
 *
 * The rules:
 *   - MULTIPLE_CHOICE and TRUE_FALSE: exactly one option selected, and it
 *     must be the correct one. Selecting two options is wrong even if one of
 *     them is right.
 *   - MULTI_SELECT: the selected set must match the correct set exactly.
 *     An extra option or a missing option is wrong.
 *   - score = round(correct / total * 100). A quiz with no questions scores 0.
 *   - passed = score >= the quiz's passing score.
 */

export type GradingQuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';

export interface GradingOption {
  id: string;
  isCorrect: boolean;
}

export interface GradingQuestion {
  id: string;
  type: GradingQuestionType;
  correctOptionIds: string[];
}

export interface GradedAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
}

export interface QuizGrade {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  answers: GradedAnswer[];
}

/** Is this answer right for this question type? */
export function isAnswerCorrect(
  type: GradingQuestionType,
  selectedOptionIds: string[],
  correctOptionIds: string[],
): boolean {
  if (type === 'MULTI_SELECT') {
    // Exact set match: same options, no extras, none missing.
    return (
      selectedOptionIds.length === correctOptionIds.length &&
      selectedOptionIds.every((id) => correctOptionIds.includes(id))
    );
  }
  // SINGLE-ANSWER: exactly one option, and it must be the correct one.
  return selectedOptionIds.length === 1 && correctOptionIds.includes(selectedOptionIds[0]!);
}

/** Grade a whole quiz. */
export function gradeQuiz(
  questions: GradingQuestion[],
  answers: Record<string, string[]>,
  passingScore: number,
): QuizGrade {
  const totalQuestions = questions.length;
  let correctCount = 0;
  const graded: GradedAnswer[] = [];

  for (const q of questions) {
    const selectedIds = answers[q.id] ?? [];
    const isCorrect = isAnswerCorrect(q.type, selectedIds, q.correctOptionIds);
    if (isCorrect) correctCount++;
    graded.push({ questionId: q.id, selectedOptionIds: selectedIds, isCorrect });
  }

  const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
  return {
    score,
    passed: score >= passingScore,
    correctCount,
    totalQuestions,
    answers: graded,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules\.bin\vitest.cmd run tests/unit/quiz-grading.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Point the server action at the shared module** — in `src/server/actions/learn.ts`, replace the inline grading block (the `// Grade` comment through the `const passed = ...` line) with:

```ts
  // Grade through the shared module so the server path and the shared-guest
  // path can never disagree about the score.
  const grade = gradeQuiz(
    attempt.quiz.questions.map((q) => ({
      id: q.id,
      type: q.type as GradingQuestionType,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    })),
    rawAnswers,
    attempt.quiz.passingScore,
  );
  const { score, passed } = grade;
  const gradedAnswers = grade.answers;
```

and add to the imports:

```ts
import { gradeQuiz, type GradingQuestionType } from '@/lib/quiz-grading';
```

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `node_modules\.bin\vitest.cmd run` then `node_modules\.bin\tsc.cmd --noEmit`
Expected: all tests pass (174 existing + 12 new), tsc reports no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/quiz-grading.ts src/server/actions/learn.ts tests/unit/quiz-grading.test.ts
git commit -m "Grade quizzes through one shared module"
```

---

### Task 2: The Share button

**Files:**
- Create: `src/components/learn/share-button.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export function ShareButton({
    url,
    title,
    label,          // "Share lesson" | "Share quiz"
  }: { url: string; title: string; label: string }): JSX.Element;
  ```

- [ ] **Step 1: Write the component** — `src/components/learn/share-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  /** Absolute URL to share. */
  url: string;
  /** Title used for the share sheet and the preview card. */
  title: string;
  /** What is being shared, e.g. "Share lesson". */
  label: string;
};

/**
 * Shares a lesson or quiz link.
 *
 * On a phone `navigator.share` opens the native sheet, which is the WhatsApp
 * path a member actually wants. Where it is not available the URL is copied to
 * the clipboard instead. Either way the full URL is shown after the action, so
 * a member whose phone refuses the clipboard can still read it out and paste
 * it by hand.
 */
export function ShareButton({ url, title, label }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const share = async () => {
    setState('idle');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return; // The user shared it, or dismissed the sheet.
      } catch {
        // A dismissed share sheet is not an error -- fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={share} className="w-full sm:w-auto">
        {state === 'copied' ? (
          <Check className="mr-2 h-4 w-4" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        {state === 'copied' ? 'Link copied' : label}
      </Button>

      {state !== 'idle' && (
        <p className="break-all text-xs text-muted-foreground">
          {state === 'copied' ? 'Link copied. Share it here: ' : 'Copy this link: '}
          <span className="font-mono text-foreground">{url}</span>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules\.bin\tsc.cmd --noEmit`
Expected: no errors. `JSX.Element` may need `React.JSX.Element` on React 19 — if tsc complains, change the return type to `React.ReactElement` and add `import type { ReactElement } from 'react'`.

- [ ] **Step 3: Commit**

```bash
git add src/components/learn/share-button.tsx
git commit -m "Add the Share button"
```

---

### Task 3: The public share routes

**Files:**
- Create: `src/app/share/layout.tsx`
- Create: `src/app/share/learn/[slug]/[lessonId]/page.tsx`
- Create: `src/app/share/learn/[slug]/quiz/page.tsx`

**Interfaces:**
- Consumes: `ShareButton` (Task 2), `renderMarkdown` / `stripLeadingHeading` from `@/lib/utils-markdown`, `getUser` from `@/lib/auth/require-user`, `prisma` from `@/lib/db`.
- Produces: the public URLs `/share/learn/<slug>/<lessonId>` and `/share/learn/<slug>/quiz`.

- [ ] **Step 1: Write the public shell** — `src/app/share/layout.tsx`:

```tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BISWIC Learning Hub',
  description:
    'A shared lesson from the BISWIC Financial Literacy Hub -- practical money lessons for Zambian civil servants and their families.',
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-navy-900 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="font-heading text-lg font-bold tracking-tight">
            BISWIC
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-navy-100">
            Financial Literacy Hub
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">{children}</main>

      <footer className="mt-8 border-t bg-muted/40">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-8 text-sm">
          <p className="font-heading font-semibold">Enjoyed this lesson?</p>
          <p className="text-muted-foreground">
            BISWIC is a savings and investment cooperative for serving members. Joining takes K100 a month.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-lg bg-navy-700 px-4 font-medium text-white hover:bg-navy-800"
            >
              Join BISWIC
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg border bg-background px-4 font-medium hover:bg-accent"
            >
              Sign in for the full hub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Write the shared lesson page** — `src/app/share/learn/[slug]/[lessonId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { renderMarkdown, stripLeadingHeading } from '@/lib/utils-markdown';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string; lessonId: string } };

async function loadLesson(slug: string, lessonId: string) {
  const module = await prisma.learningModule.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      audience: true,
      isPublished: true,
      lessons: {
        where: { id: lessonId },
        select: { id: true, title: true, content: true, estimatedMin: true, order: true },
      },
    },
  });
  if (!module || !module.isPublished) return null;
  const lesson = module.lessons[0];
  if (!lesson) return null;
  return { module, lesson };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadLesson(params.slug, params.lessonId);
  if (!data) return { title: 'Lesson not found', robots: { index: false } };
  const title = `${data.lesson.title} — ${data.module.title}`;
  return {
    title,
    description: data.module.summary,
    robots: { index: false, follow: false },
    openGraph: { title, description: data.module.summary, type: 'article' },
  };
}

export default async function SharedLessonPage({ params }: Props) {
  const data = await loadLesson(params.slug, params.lessonId);
  if (!data) notFound();
  const { module, lesson } = data;

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">
          {module.title}
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {lesson.title}
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {lesson.estimatedMin} min read
        </div>
      </header>

      <div
        className="lesson-content"
        dangerouslySetInnerHTML={{
          __html: renderMarkdown(stripLeadingHeading(lesson.content)),
        }}
      />

      <p className="rounded-lg border border-gold-200 bg-gold-50/60 p-4 text-sm text-muted-foreground">
        Shared from the BISWIC Financial Literacy Hub. Join BISWIC to work through every module and keep your
        progress.
      </p>
    </article>
  );
}
```

- [ ] **Step 3: Write the shared quiz page** — `src/app/share/learn/[slug]/quiz/page.tsx`:

The page resolves the module, checks it is published and shareable, and then branches on `getUser()`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { GuestQuiz } from '@/components/learn/guest-quiz';
import { QuizRunner } from '@/components/learn/quiz-runner';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string } };

async function loadQuiz(slug: string) {
  const module = await prisma.learningModule.findUnique({
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
              options: { select: { id: true, text: true, order: true, isCorrect: true } },
            },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });
  if (!module || !module.isPublished || !module.quiz) return null;
  return module;
}

/**
 * A shared module is only shareable if its audience includes MEMBER. Every
 * module published today lists every role, so all of them are shareable; a
 * module later restricted to officers alone is not, and its shared URL 404s.
 */
function isShareable(audience: string[]): boolean {
  return audience.length === 0 || audience.includes('MEMBER');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const module = await loadQuiz(params.slug);
  if (!module) return { title: 'Quiz not found', robots: { index: false } };
  const title = `${module.quiz!.title} — ${module.title}`;
  return {
    title,
    description: module.summary,
    robots: { index: false, follow: false },
    openGraph: { title, description: module.summary, type: 'article' },
  };
}

export default async function SharedQuizPage({ params }: Props) {
  const module = await loadQuiz(params.slug);
  if (!module) notFound();
  if (!isShareable(module.audience)) notFound();

  const quiz = module.quiz!;
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
      questionId: q.questionId,
      text: o.text,
      order: o.order,
      isCorrect: o.isCorrect,
    })),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">{module.title}</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">
          {questions.length} questions · {quiz.passingScore}% to pass
        </p>
      </header>

      {user ? (
        <>
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            You are signed in, so this attempt is recorded against your account.
          </p>
          <QuizRunner
            quizId={quiz.id}
            moduleSlug={module.slug}
            questions={questions.map(({ explanation: _e, ...q }) => q)}
            options={options.map(({ isCorrect: _c, ...o }) => o)}
            existingAttemptId={null}
          />
        </>
      ) : (
        <GuestQuiz
          questions={questions}
          options={options}
          passingScore={quiz.passingScore}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and build**

Run: `node_modules\.bin\tsc.cmd --noEmit` then `node_modules\.bin\next.cmd build`
Expected: no type errors, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/share
git commit -m "Add the public share routes"
```

---

### Task 4: The guest quiz, graded in the browser

**Files:**
- Create: `src/components/learn/guest-quiz.tsx`

**Interfaces:**
- Consumes: `gradeQuiz` from `@/lib/quiz-grading`.
- Produces:
  ```ts
  export function GuestQuiz({
    questions, options, passingScore,
  }: {
    questions: { id: string; order: number; prompt: string; type: GradingQuestionType; explanation: string | null }[];
    options: { id: string; questionId: string; text: string; order: number; isCorrect: boolean }[];
    passingScore: number;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the component** — `src/components/learn/guest-quiz.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gradeQuiz, type GradingQuestionType } from '@/lib/quiz-grading';

type GuestQuestion = {
  id: string;
  order: number;
  prompt: string;
  type: GradingQuestionType;
  explanation: string | null;
};

type GuestOption = {
  id: string;
  questionId: string;
  text: string;
  order: number;
  isCorrect: boolean;
};

/**
 * The shared quiz, scored in the browser.
 *
 * Nothing is stored: no attempt, no answers, no member record. That is what
 * "anyone can take a shared quiz" means without an account -- and it is why
 * the answer key travels to the browser. The member quiz is unaffected; it
 * still grades on the server and its key never leaves.
 */
export function GuestQuiz({
  questions,
  options,
  passingScore,
}: {
  questions: GuestQuestion[];
  options: GuestOption[];
  passingScore: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  const grade = useMemo(
    () =>
      gradeQuiz(
        questions.map((q) => ({
          id: q.id,
          type: q.type,
          correctOptionIds: options
            .filter((o) => o.questionId === q.id && o.isCorrect)
            .map((o) => o.id),
        })),
        answers,
        passingScore,
      ),
    [questions, options, answers, passingScore],
  );

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>;
  }

  const toggle = (question: GuestQuestion, optionId: string) => {
    setAnswers((prev) => {
      const cur = prev[question.id] ?? [];
      if (question.type === 'MULTI_SELECT') {
        return {
          ...prev,
          [question.id]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId],
        };
      }
      return { ...prev, [question.id]: cur[0] === optionId ? [] : [optionId] };
    });
  };

  const allAnswered = questions.every((q) => (answers[q.id] ?? []).length > 0);

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-gold-200 bg-gold-50/60 p-4 text-sm text-muted-foreground">
        You are not signed in, so this result is not saved. Read every question, choose your answer, then press
        &ldquo;Show my score&rdquo;.
      </p>

      {questions.map((q, index) => {
        const selected = answers[q.id] ?? [];
        const result = grade.answers.find((a) => a.questionId === q.id);
        return (
          <section key={q.id} className="rounded-lg border bg-card p-4 sm:p-6">
            <p className="font-medium leading-relaxed">
              {index + 1}. {q.prompt}
            </p>

            <ul className="mt-3 space-y-2">
              {options
                .filter((o) => o.questionId === q.id)
                .map((o) => {
                  const chosen = selected.includes(o.id);
                  const isRight = o.isCorrect;
                  let tone = 'border bg-background hover:border-navy-300';
                  if (submitted) {
                    if (isRight) tone = 'border-emerald-300 bg-emerald-50';
                    else if (chosen) tone = 'border-red-300 bg-red-50';
                  } else if (chosen) {
                    tone = 'border-navy-500 bg-navy-50';
                  }
                  return (
                    <li key={o.id}>
                      <label className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-lg border p-3 ${tone}`}>
                        <input
                          type={q.type === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                          name={`guest-${q.id}`}
                          checked={chosen}
                          disabled={submitted}
                          onChange={() => toggle(q, o.id)}
                          className="mt-0.5 h-5 w-5 shrink-0 accent-navy-700"
                        />
                        <span className="text-sm leading-relaxed">{o.text}</span>
                      </label>
                    </li>
                  );
                })}
            </ul>

            {submitted && (
              <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm">
                <p
                  className={`flex items-center gap-2 font-medium ${
                    result?.isCorrect ? 'text-emerald-700' : 'text-destructive'
                  }`}
                >
                  {result?.isCorrect ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <CircleAlert className="h-4 w-4" />
                  )}
                  {result?.isCorrect ? 'Correct' : 'Not correct'}
                </p>
                {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
              </div>
            )}
          </section>
        );
      })}

      {!submitted ? (
        <Button onClick={() => setSubmitted(true)} disabled={!allAnswered} className="h-11 w-full">
          <Send className="mr-2 h-4 w-4" />
          Show my score
        </Button>
      ) : (
        <div className="rounded-lg border border-navy-200 bg-navy-50 p-5 text-center">
          <p className="font-heading text-3xl font-bold text-navy-700">{grade.score}%</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {grade.correctCount} of {grade.totalQuestions} correct · {grade.passed ? 'Passed' : 'Not passed'} (
            {passingScore}% needed)
          </p>
          <p className="mt-3 text-sm">
            <a href="/register" className="font-medium underline">
              Join BISWIC
            </a>{' '}
            to keep your scores and unlock the rest of the hub.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules\.bin\tsc.cmd --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/learn/guest-quiz.tsx
git commit -m "Add the browser-graded shared quiz"
```

---

### Task 5: Put the Share button on the member pages

**Files:**
- Modify: `src/app/(authed)/learn/[slug]/[lessonId]/page.tsx`
- Modify: `src/app/(authed)/learn/[slug]/quiz/page.tsx`

**Interfaces:**
- Consumes: `ShareButton` (Task 2).
- Produces: a share link on every lesson and every module quiz.

- [ ] **Step 1: Add the Share button to the lesson page**

In `src/app/(authed)/learn/[slug]/[lessonId]/page.tsx`, add the import:

```tsx
import { ShareButton } from '@/components/learn/share-button';
```

and insert this block immediately after the `</header>` closing tag (so it sits between the title and the lesson body):

```tsx
      <ShareButton
        url={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://biswic.vercel.app'}/share/learn/${lesson.module.slug}/${lesson.id}`}
        title={lesson.title}
        label="Share lesson"
      />
```

- [ ] **Step 2: Add the Share button to the quiz page**

In `src/app/(authed)/learn/[slug]/quiz/page.tsx`, add the import:

```tsx
import { ShareButton } from '@/components/learn/share-button';
```

and insert this block immediately after the `</header>` closing tag:

```tsx
      <ShareButton
        url={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://biswic.vercel.app'}/share/learn/${learningModule.slug}/quiz`}
        title={learningModule.quiz.title}
        label="Share quiz"
      />
```

- [ ] **Step 3: Typecheck and build**

Run: `node_modules\.bin\tsc.cmd --noEmit` then `node_modules\.bin\next.cmd build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/learn"
git commit -m "Offer the Share button on lessons and quizzes"
```

---

### Task 6: The bundle matcher — pure, and unable to delete

**Files:**
- Create: `src/lib/learning-import.ts`
- Test: `tests/unit/learning-import.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface BundleLesson { order: number; title: string; content: string; estimatedMin: number; }
  export interface BundleModule {
    slug: string; title: string; summary: string; content?: string;
    audience: string[]; order: number; isPublished: boolean;
    lessons: BundleLesson[];
    quiz?: BundleQuiz | null;
  }
  export interface BundleQuiz {
    title: string; passingScore: number;
    questions: { order: number; prompt: string; type: string; explanation?: string | null;
                 options: { text: string; correct: boolean; order: number }[] }[];
  }
  export interface LearningBundle { modules: BundleModule[]; }

  export type ModulePlan =
    | { action: 'create'; slug: string; lessons: LessonPlan[]; quizAction: 'create' | 'skip' }
    | { action: 'update'; slug: string; lessons: LessonPlan[]; quizAction: 'create' | 'skip' };
  export type LessonPlan =
    | { action: 'create'; order: number; title: string }
    | { action: 'update'; order: number; title: string };

  export function planLearningImport(
    current: { slug: string; lessonOrders: number[]; hasQuiz: boolean }[],
    bundle: LearningBundle,
  ): { modules: ModulePlan[]; totals: { modulesCreated: number; modulesUpdated: number;
      lessonsCreated: number; lessonsUpdated: number; deleted: number } };
  export function parseBundle(text: string): { ok: true; bundle: LearningBundle } | { ok: false; error: string };
  ```

- [ ] **Step 1: Write the failing test** — `tests/unit/learning-import.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseBundle, planLearningImport } from '@/lib/learning-import';

const bundle = {
  modules: [
    {
      slug: 'existing-module',
      title: 'Existing Module',
      summary: 'Updated summary',
      audience: ['MEMBER'],
      order: 6,
      isPublished: true,
      lessons: [
        { order: 1, title: 'Lesson One', content: '# One', estimatedMin: 6 },
        { order: 2, title: 'Lesson Two', content: '# Two', estimatedMin: 7 },
      ],
    },
  ],
};

describe('planLearningImport', () => {
  it('updates a module that already exists', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1, 2], hasQuiz: true }],
      bundle,
    );
    expect(plan.modules[0]!.action).toBe('update');
  });

  it('creates a module that does not exist', () => {
    const plan = planLearningImport([], bundle);
    expect(plan.modules[0]!.action).toBe('create');
  });

  it('updates a lesson whose order already exists', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1, 2], hasQuiz: true }],
      bundle,
    );
    const lessons = plan.modules[0]!.lessons;
    expect(lessons.every((l) => l.action === 'update')).toBe(true);
  });

  it('creates a lesson whose order does not exist', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1], hasQuiz: true }],
      bundle,
    );
    const lessons = plan.modules[0]!.lessons;
    expect(lessons[0]!.action).toBe('update');
    expect(lessons[1]!.action).toBe('create');
  });

  it('never deletes anything, even when a lesson is missing from the bundle', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1, 2, 3], hasQuiz: true }],
      bundle,
    );
    expect(plan.totals.deleted).toBe(0);
  });

  it('leaves an existing quiz alone when the bundle carries none', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1, 2], hasQuiz: true }],
      bundle,
    );
    expect(plan.modules[0]!.quizAction).toBe('skip');
  });

  it('creates a quiz only when the module has none and the bundle carries one', () => {
    const withQuiz = {
      modules: [
        {
          ...bundle.modules[0]!,
          quiz: {
            title: 'Quiz',
            passingScore: 70,
            questions: [
              { order: 1, prompt: 'Q?', type: 'MULTIPLE_CHOICE',
                options: [{ text: 'A', correct: true, order: 1 }] },
            ],
          },
        },
      ],
    };
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1, 2], hasQuiz: false }],
      withQuiz,
    );
    expect(plan.modules[0]!.quizAction).toBe('create');
  });

  it('counts created and updated modules and lessons', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1], hasQuiz: true }],
      bundle,
    );
    expect(plan.totals.modulesUpdated).toBe(1);
    expect(plan.totals.modulesCreated).toBe(0);
    expect(plan.totals.lessonsUpdated).toBe(1);
    expect(plan.totals.lessonsCreated).toBe(1);
    expect(plan.totals.deleted).toBe(0);
  });
});

describe('parseBundle', () => {
  it('rejects malformed JSON with a readable error', () => {
    const result = parseBundle('{ not json');
    expect(result.ok).toBe(false);
  });

  it('rejects a bundle with no modules array', () => {
    const result = parseBundle('{"nope": true}');
    expect(result.ok).toBe(false);
  });

  it('accepts a well-formed bundle', () => {
    const result = parseBundle(JSON.stringify(bundle));
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules\.bin\vitest.cmd run tests/unit/learning-import.test.ts`
Expected: FAIL — "Cannot find module '@/lib/learning-import'".

- [ ] **Step 3: Write the implementation** — `src/lib/learning-import.ts`:

```ts
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
  quizAction: 'create' | 'skip';
};

export interface ImportTotals {
  modulesCreated: number;
  modulesUpdated: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  deleted: number;
}

export interface CurrentModule {
  slug: string;
  lessonOrders: number[];
  hasQuiz: boolean;
}

/**
 * Work out what applying a bundle would do. Pure: it reads a description of
 * the current modules and returns a plan. It never touches a database, so the
 * admin panel can show the chairman exactly what will happen before
 * anything is written.
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

    // A quiz is only created when the module has none and the bundle brings
    // one. An existing quiz is never replaced: that would clear every member's
    // stored answers for it.
    const quizAction: 'create' | 'skip' =
      bm.quiz && existing && !existing.hasQuiz ? 'create' : 'skip';

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
    lessonsCreated: modules.reduce((n, m) => n + m.lessons.filter((l) => l.action === 'create').length, 0),
    lessonsUpdated: modules.reduce((n, m) => n + m.lessons.filter((l) => l.action === 'update').length, 0),
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

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'A bundle must be a JSON object.' };
  }
  const modules = (parsed as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) {
    return { ok: false, error: 'A bundle must have a "modules" array.' };
  }

  for (const [i, m] of modules.entries()) {
    if (typeof m !== 'object' || m === null) {
      return { ok: false, error: `Module ${i + 1} is not an object.` };
    }
    const mod = m as Partial<BundleModule>;
    if (typeof mod.slug !== 'string' || mod.slug.length === 0) {
      return { ok: false, error: `Module ${i + 1} has no "slug".` };
    }
    if (!Array.isArray(mod.lessons)) {
      return { ok: false, error: `Module "${mod.slug}" has no "lessons" array.` };
    }
    for (const [j, l] of mod.lessons.entries()) {
      const lesson = l as Partial<BundleLesson>;
      if (typeof lesson.order !== 'number') {
        return { ok: false, error: `Lesson ${j + 1} of "${mod.slug}" has no numeric "order".` };
      }
      if (typeof lesson.content !== 'string') {
        return { ok: false, error: `Lesson ${j + 1} of "${mod.slug}" has no "content".` };
      }
    }
  }

  return { ok: true, bundle: parsed as LearningBundle };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules\.bin\vitest.cmd run tests/unit/learning-import.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/learning-import.ts tests/unit/learning-import.test.ts
git commit -m "Add the bundle matcher, which can never delete"
```

---

### Task 7: The admin learning editor

**Files:**
- Create: `src/server/actions/learning-admin.ts`
- Create: `src/app/(authed)/admin/learning/page.tsx`
- Create: `src/components/learn/admin-lesson-editor.tsx`
- Create: `src/components/learn/admin-import-panel.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `planLearningImport`, `parseBundle` from `@/lib/learning-import`; `requireUser` from `@/lib/auth/require-user`; `logAudit`, `AUDIT_ACTIONS` from `@/lib/audit`.
- Produces:
  ```ts
  // src/server/actions/learning-admin.ts
  export async function updateLessonAction(formData: FormData):
    Promise<{ success: true } | { error: string }>;
  export async function applyLearningBundleAction(formData: FormData):
    Promise<{ success: true; summary: string } | { error: string }>;
  ```

- [ ] **Step 1: Write the server actions** — `src/server/actions/learning-admin.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
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

async function requireLearningEditor() {
  const user = await requireUser();
  if (!user.isAdmin && !OFFICER_ROLES.includes(user.role)) {
    return null;
  }
  return user;
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
  if (!parsed.success) return { error: 'Please check the lesson title, minutes and body.' };

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
  return { success: true };
}

const bundleSchema = z.object({ bundle: z.string().min(1) });

/**
 * Apply a content bundle.
 *
 * Modules are matched by slug and lessons by order. Nothing is ever deleted:
 * a lesson the bundle omits stays exactly as it is, so no member loses
 * progress. An existing quiz is never replaced.
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
      slug: true,
      isPublished: true,
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

    if (!existing) {
      await prisma.learningModule.create({
        data: {
          slug: bm.slug,
          title: bm.title,
          summary: bm.summary,
          content: bm.content ?? bm.summary,
          audience: bm.audience as never,
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
        audience: bm.audience as never,
        isPublished: bm.isPublished,
        order: bm.order,
      },
    });

    for (const bl of bm.lessons) {
      // Match by order. Updating in place keeps the lesson id, and therefore
      // every member's LessonProgress row for it.
      await prisma.learningLesson.upsert({
        where: { moduleId_order: { moduleId: existing.slug, order: bl.order } },
        update: { title: bl.title, content: bl.content, estimatedMin: bl.estimatedMin },
        create: {
          moduleId: (await prisma.learningModule.findUniqueOrThrow({
            where: { slug: bm.slug },
            select: { id: true },
          })).id,
          order: bl.order,
          title: bl.title,
          content: bl.content,
          estimatedMin: bl.estimatedMin,
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
```

**Note:** the `upsert` above uses `moduleId_order`, but the compound key needs the module **id**, not the slug. Resolve the module id once per module and reuse it:

```ts
    const moduleId = existing.id ?? (
      await prisma.learningModule.create({
        data: {
          slug: bm.slug,
          title: bm.title,
          summary: bm.summary,
          content: bm.content ?? bm.summary,
          audience: bm.audience as never,
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
        },
        select: { id: true },
      })
    ).id;
```

and then `if (!existing) { continue; }` after that block, with the upsert using `moduleId_order: { moduleId, order: bl.order }`.

- [ ] **Step 2: Write the admin page** — `src/app/(authed)/admin/learning/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import { AdminLessonEditor } from '@/components/learn/admin-lesson-editor';
import { AdminImportPanel } from '@/components/learn/admin-import-panel';

export const dynamic = 'force-dynamic';

const OFFICER_ROLES = [
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'SECRETARY',
  'TREASURER',
  'DEPUTY_TREASURER',
  'FW',
  'CCD',
];

export default async function AdminLearningPage() {
  const user = await requireUser();
  if (!user.isAdmin && !OFFICER_ROLES.includes(user.role)) {
    redirect('/dashboard');
  }

  const modules = await prisma.learningModule.findMany({
    orderBy: [{ order: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      isPublished: true,
      order: true,
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, order: true, title: true, content: true, estimatedMin: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Learning Hub editor</h1>
        <p className="text-sm text-muted-foreground">
          Edit any lesson, or apply a content bundle. Nothing is ever deleted, and no member loses progress.
        </p>
      </header>

      <AdminLessonEditor modules={modules} />
      <AdminImportPanel />
    </div>
  );
}
```

- [ ] **Step 3: Write the lesson editor component** — `src/components/learn/admin-lesson-editor.tsx`:

A client component holding the list of modules and lessons in state, a select to pick a lesson, and a form with three fields (title, estimated minutes, markdown body). On save it posts to `updateLessonAction` with a `FormData`.

```tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateLessonAction } from '@/server/actions/learning-admin';

type Lesson = {
  id: string;
  order: number;
  title: string;
  content: string;
  estimatedMin: number;
};

type Module = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  isPublished: boolean;
  order: number;
  lessons: Lesson[];
};

export function AdminLessonEditor({ modules }: { modules: Module[] }) {
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.lessons[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [estimatedMin, setEstimatedMin] = useState(5);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lesson = useMemo(
    () => modules.flatMap((m) => m.lessons).find((l) => l.id === selectedId) ?? null,
    [modules, selectedId],
  );

  const pick = (id: string) => {
    setSelectedId(id);
    setSaved(false);
    setError(null);
    const l = modules.flatMap((m) => m.lessons).find((x) => x.id === id);
    if (l) {
      setTitle(l.title);
      setEstimatedMin(l.estimatedMin);
      setContent(l.content);
    }
  };

  const save = () => {
    setSaved(false);
    setError(null);
    const fd = new FormData();
    fd.set('lessonId', selectedId);
    fd.set('title', title);
    fd.set('estimatedMin', String(estimatedMin));
    fd.set('content', content);
    startTransition(async () => {
      const result = await updateLessonAction(fd);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="font-heading text-lg font-semibold">Edit a lesson</h2>

      <label className="block text-sm font-medium">
        Lesson
        <select
          value={selectedId}
          onChange={(e) => pick(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm"
        >
          {modules.map((m) => (
            <optgroup key={m.id} label={`${m.title}${m.isPublished ? '' : ' (unpublished)'}`}>
              {m.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.order}. {l.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {lesson && (
        <>
          <label className="block text-sm font-medium">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Estimated minutes
            <input
              type="number"
              min={1}
              max={120}
              value={estimatedMin}
              onChange={(e) => setEstimatedMin(Number(e.target.value))}
              className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Body (markdown)
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="mt-1 w-full rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={pending}>
              <Save className="mr-2 h-4 w-4" />
              {pending ? 'Saving' : 'Save lesson'}
            </Button>
            {saved && <span className="text-sm text-emerald-700">Saved. The change is live.</span>}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write the import panel** — `src/components/learn/admin-import-panel.tsx`:

```tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyLearningBundleAction } from '@/server/actions/learning-admin';
import { parseBundle, planLearningImport, type LearningBundle } from '@/lib/learning-import';

export function AdminImportPanel() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseBundle(text), [text]);

  const preview = useMemo(() => {
    if (!parsed.ok) return null;
    // A dry run: the plan is computed from the bundle alone, so the summary
    // below is exactly what the apply step will do.
    return planLearningImport([], parsed.bundle as LearningBundle);
  }, [parsed]);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setError(null);
      setApplied(null);
    };
    reader.readAsText(file);
  };

  const apply = () => {
    setError(null);
    setApplied(null);
    const fd = new FormData();
    fd.set('bundle', text);
    startTransition(async () => {
      const result = await applyLearningBundleAction(fd);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      setApplied(result.summary ?? 'Applied.');
    });
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="font-heading text-lg font-semibold">Apply a content bundle</h2>
      <p className="text-sm text-muted-foreground">
        Paste a bundle or load a JSON file. Lessons are matched by module slug and lesson order. Nothing is
        deleted, and members keep their progress.
      </p>

      <label className="block text-sm font-medium">
        Bundle JSON
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            setApplied(null);
          }}
          rows={12}
          placeholder='{"modules": [ ... ]}'
          className="mt-1 w-full rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-medium hover:bg-accent">
          <FileUp className="mr-2 h-4 w-4" />
          Load a JSON file
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
            }}
          />
        </label>

        <Button onClick={apply} disabled={pending || !parsed.ok}>
          <Upload className="mr-2 h-4 w-4" />
          {pending ? 'Applying' : 'Apply bundle'}
        </Button>
      </div>

      {parsed.ok && preview && (
        <p className="rounded-md bg-muted/50 p-3 text-sm">
          Dry run: {preview.totals.modulesCreated} modules to create, {preview.totals.modulesUpdated} to update,{' '}
          {preview.totals.lessonsCreated} lessons to create, {preview.totals.lessonsUpdated} to update,{' '}
          {preview.totals.deleted} deleted.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {applied && <p className="text-sm text-emerald-700">Applied: {applied}</p>}
    </section>
  );
}
```

- [ ] **Step 5: Add the admin link to the sidebar** — in `src/components/layout/sidebar.tsx`, add a "Learning editor" entry beside the existing admin items, pointing at `/admin/learning`, shown only to admins and officers.

- [ ] **Step 6: Typecheck, lint and build**

Run: `node_modules\.bin\tsc.cmd --noEmit`, `node_modules\.bin\next.cmd lint`, `node_modules\.bin\next.cmd build`
Expected: no type errors, no new lint errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/server/actions/learning-admin.ts "src/app/(authed)/admin/learning" src/components/learn src/components/layout/sidebar.tsx
git commit -m "Add the admin learning editor and the bundle apply action"
```

---

### Task 8: The content bundles

**Files:**
- Create: `docs/learning-bundles/01-existing-modules.json`
- Create: `docs/learning-bundles/02-new-modules.json`

**Interfaces:**
- Consumes: the bundle shape from `@/lib/learning-import`.
- Produces: two JSON files that the admin import panel loads.

- [ ] **Step 1: Write the rewritten 17 lessons** — bundle 01 carries the ten existing published modules with their **same slugs, same lesson counts and same lesson orders**, each lesson body rewritten from the research with current, sourced figures.

Every lesson body follows the house style: an H1 opening line, short sections, pipe tables, a **"What to do this week"** box of two or three concrete actions, and a **"Where to check"** line naming the institution to verify the figures against. Roughly 2,000–5,000 characters each.

The three bodies that the research shows to be factually wrong must be corrected:

- The **NHIMA** lesson says the waiting period is six months and that dental and optical care are excluded. Both are wrong: the waiting period is **4 months** (no waiting period at 65 and above), and dental, vision and spectacles are **in** the benefit package (spectacles once every three years). The 6-beneficiary cap is NHIMA's own FAQ figure; the July 2024 Ministerial Statement says "one plus six". Give both and tell members to confirm with NHIMA on **8000** before registering dependants.
- The **sakawa** lesson defines it as advance-fee fraud. It is not: "sakawa" is the Hausa word for Ponzi and pyramid schemes, and the official Zambian legal term is a **"money circulation scheme"** under section 157 of the Banking and Financial Services Act. Advance-fee fraud is a different crime. Teach the official words, because those are the words a member needs when reporting.
- The **savings** lesson claims a 2–4% bank deposit rate "beats" something. With inflation at 6.1%, that comparison is false. The lesson must say that a 7.4% six-month deposit rate beats 6.1% inflation by about 1.3 percentage points, and that the point is not the rate but the habit.

- [ ] **Step 2: Write the three new modules** — bundle 02 carries three new modules at orders 16, 17 and 18, chosen from the research's "biggest content gaps":

1. **`your-cooperative`** — *Your Cooperative: Member Rights, AGMs and Reading the Accounts*. Co-operative law gives members real teeth and none of it is taught: an audited statement on request within six months, the right to inspect the balance sheet, a **6% dividend cap**, **no dividend before an audit**, and one-third of members able to force a Registrar inquiry.
2. **`insurance-and-claims`** — *Insurance and Claims: Covering a Funeral, a Hospital Bill and Your Family's Future*. Funeral cover is the best-value product for this audience; claims need a document pack filed within **6 months** (documents within 12); PIA investigates complaints in **10 business days** and now issues **Key Fact Statements**.
3. **`small-business-basics`** — *Running a Small Business: Register, Tax and Keep the Records*. Turnover tax from 1 January 2026: **0% on the first K30,000 a year**, 5% to K5 million, on gross sales rather than profit. PACRA business name K166, company K1,000.

Each module gets one to three lessons, a summary, and its own quiz, because a module without a quiz breaks the hub's "a quiz at the end of every module" promise. The three new quizzes are **new** — the ten existing quizzes are untouched.

- [ ] **Step 3: Validate the bundles against the plan** — paste each bundle into the admin panel and confirm the dry-run summary reads: bundle 01 → 10 modules updated, 17 lessons updated, 0 created, **0 deleted**; bundle 02 → 3 modules created, 9 lessons created, 3 quizzes created, **0 deleted**.

- [ ] **Step 4: Apply bundle 01, then bundle 02, through the admin panel**

- [ ] **Step 5: Verify** — the hub shows 13 modules; every one of the 17 rewritten lessons carries the new body; the three new modules are live; and the chairman's own progress still reads the same number of completed lessons against a larger total.

- [ ] **Step 6: Commit the bundles**

```bash
git add docs/learning-bundles
git commit -m "Add the researched content bundles"
```

---

### Task 9: Ship it

- [ ] **Step 1: Normalise line endings and run the full gate**

Run: `python C:\Users\RICHARD_TEMBO\AppData\Local\Temp\fix-eol2.py <each touched file>`, then `node_modules\.bin\vitest.cmd run`, `node_modules\.bin\tsc.cmd --noEmit`, `node_modules\.bin\next.cmd lint`, `node_modules\.bin\next.cmd build`.
Expected: every test passes, tsc clean, no new lint errors, build green.

- [ ] **Step 2: Commit and push in ONE commit**

```bash
git add -A src tests docs
git commit -m "Let members share lessons and quizzes, and add the learning editor"
git push origin main
```

- [ ] **Step 3: Verify on the live site**

With the tunnel and proxy running, open the shared URLs in a **private window with no session**:
`/share/learn/<slug>/<lessonId>` and `/share/learn/<slug>/quiz`. The lesson renders, the guest quiz grades and explains, and nothing is written to the database. Then sign in and confirm a shared-quiz attempt appears in **My Learning**, and that the chairman's lesson progress is unchanged.

---

## Self-Review

**Spec coverage.** Section 5.1 routes → Task 3. 5.2 URLs → Task 3. 5.3 access rules → Task 3 (`isShareable`). 5.4 the Share button → Task 2, wired in Task 5. 5.5 link preview → Task 3 (`generateMetadata` + `robots`). 5.6 the shared quiz → Task 3. 5.7 the trade-off → recorded in Task 4's doc comment and in the guest notice. 5.8 the runner change → Task 1 (grading) and Task 3 (guest branch). Section 6.1 the lesson editor → Task 7. 6.2 bulk import → Tasks 6 and 7. Section 7.1 research → done, committed as `docs/learning-hub-research-2026-11.md` and `…-part2.md`. 7.2 the 17 lessons → Task 8. 7.3 three new modules → Task 8. 7.4 the existing quizzes → untouched, asserted in Task 6's test. Section 9 error handling → Task 3 (`notFound`), Task 2 (clipboard failure shows the URL), Task 7 (parse errors name the position). Section 10 testing → Tasks 1, 6 and 9.

**Placeholder scan.** No "TBD", no "similar to Task N", no "add appropriate error handling". Every code step carries real code. The one place a judgement call remains is the sidebar link in Task 7 Step 5, which is a single entry added beside existing admin items.

**Type consistency.** `gradeQuiz` returns `QuizGrade` with `{ score, passed, correctCount, totalQuestions, answers }` and is called identically from Task 1's server action and Task 4's guest component. `planLearningImport` returns `{ modules, totals }` and is called identically from Task 6's tests and Task 7's panel and action. `parseBundle` returns a discriminated union `{ ok: true; bundle }` / `{ ok: false; error }` in both places.

**One correction to the spec.** Section 6.2's rule 4 says a quiz is created "only for a module whose quiz does not already exist", which is right, but the spec's dry-run summary counts do not include quizzes. Task 6's `ModulePlan.quizAction` makes the quiz decision explicit and `ImportTotals` carries the other four counts. The spec's `bundle.quiz` shape is preserved exactly.
