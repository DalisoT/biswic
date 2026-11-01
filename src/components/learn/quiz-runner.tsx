'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronLeft, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startQuizAttemptAction, submitQuizAttemptAction } from '@/server/actions/learn';

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';

interface Question {
  id: string;
  order: number;
  prompt: string;
  type: QuestionType;
}

interface Option {
  id: string;
  questionId: string;
  text: string;
  order: number;
}

const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  MULTI_SELECT: 'Multi-select',
};

export function QuizRunner({
  quizId,
  moduleSlug,
  questions,
  options,
  existingAttemptId,
}: {
  quizId: string;
  moduleSlug: string;
  questions: Question[];
  options: Option[];
  existingAttemptId: string | null;
}) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(existingAttemptId);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, startSubmit] = useTransition();
  const [starting, startStart] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ensureAttempt = async (): Promise<string | null> => {
    if (attemptId) return attemptId;
    const fd = new FormData();
    fd.set('quizId', quizId);
    return new Promise((resolve) => {
      startStart(async () => {
        const result = await startQuizAttemptAction(fd);
        if ('error' in result && result.error) {
          setError(result.error);
          resolve(null);
        } else if ('success' in result && result.success && result.attemptId) {
          setAttemptId(result.attemptId);
          resolve(result.attemptId);
        } else {
          resolve(null);
        }
      });
    });
  };

  const q = questions[current];
  const total = questions.length;
  const selected = q ? (answers[q.id] ?? []) : [];
  const allAnswered = questions.every((qq) => (answers[qq.id] ?? []).length > 0);
  const answeredCount = questions.filter((qq) => (answers[qq.id] ?? []).length > 0).length;

  const toggle = (optionId: string) => {
    if (!q) return;
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.type === 'MULTI_SELECT') {
        // multi-select: toggle membership
        const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
        return { ...prev, [q.id]: next };
      }
      // SINGLE-ANSWER: replace
      return { ...prev, [q.id]: cur[0] === optionId ? [] : [optionId] };
    });
  };

  const goNext = () => {
    if (current < total - 1) setCurrent((c) => c + 1);
  };
  const goPrev = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  const submit = async () => {
    setError(null);
    const aid = await ensureAttempt();
    if (!aid) return;

    const fd = new FormData();
    fd.set('attemptId', aid);
    fd.set('answers', JSON.stringify(answers));
    startSubmit(async () => {
      const result = await submitQuizAttemptAction(fd);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      const r = result as { success?: boolean; attemptId?: string; score?: number; passed?: boolean };
      if (r.attemptId) {
        router.push(`/learn/${moduleSlug}/quiz/result?attempt=${r.attemptId}`);
      }
    });
  };

  if (!q) {
    return <p className="text-sm text-muted-foreground">No questions in this quiz yet.</p>;
  }

  const qOptions = options.filter((o) => o.questionId === q.id);
  const currentSelected = answers[q.id] ?? [];
  const canAdvance = currentSelected.length > 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Question {current + 1} of {total}
          </span>
          <span>
            {answeredCount} of {total} answered
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-navy-700 transition-all"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <section className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <span className="shrink-0 self-start rounded-full border border-navy-200 bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
              {TYPE_LABEL[q.type]}
            </span>
            <p className="text-lg font-medium leading-relaxed">{q.prompt}</p>
          </div>

          <ul className="space-y-2">
            {qOptions.map((o) => {
              const checked = currentSelected.includes(o.id);
              return (
                <li key={o.id}>
                  <label
                    className={
                      'flex min-h-[52px] cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ' +
                      (checked
                        ? 'border-navy-500 bg-navy-50'
                        : 'hover:border-navy-300 hover:bg-navy-50/50')
                    }
                  >
                    <input
                      type={q.type === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                      name={`q-${q.id}`}
                      value={o.id}
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-navy-700"
                    />
                    <span className="text-sm leading-relaxed">{o.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Quick-jump */}
      <div className="flex flex-wrap gap-2">
        {questions.map((qq, i) => {
          const answered = (answers[qq.id] ?? []).length > 0;
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              aria-label={`Go to question ${i + 1}${answered ? ' (answered)' : ''}`}
              aria-current={i === current ? 'true' : undefined}
              className={
                'flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors ' +
                (i === current
                  ? 'border-navy-700 bg-navy-700 text-white'
                  : answered
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'bg-background text-muted-foreground hover:border-navy-300')
              }
            >
              {answered && i !== current ? <CheckCircle2 className="mx-auto h-4 w-4" /> : i + 1}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Action bar -- pinned to the bottom of a phone, in flow on desktop */}
      <div className="learn-action-bar">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={current === 0}
            className="h-11 w-11 shrink-0"
            aria-label="Previous question"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {current < total - 1 ? (
            <Button onClick={goNext} disabled={!canAdvance} className="h-11 flex-1">
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={!allAnswered || submitting}
              className="h-11 flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit quiz
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
