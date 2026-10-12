'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {current + 1} of {total}
        </span>
        <span>{Object.keys(answers).filter((k) => (answers[k] ?? []).length > 0).length} answered</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <Card className="border-2">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="shrink-0 mt-1">
              {q.type === 'MULTI_SELECT' ? 'Multi-select' : q.type === 'TRUE_FALSE' ? 'True / False' : 'Multiple choice'}
            </Badge>
            <p className="text-lg font-medium leading-relaxed">{q.prompt}</p>
          </div>

          <ul className="space-y-2">
            {qOptions.map((o) => {
              const checked = currentSelected.includes(o.id);
              return (
                <li key={o.id}>
                  <label
                    className={
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ' +
                      (checked
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'hover:border-emerald-300 hover:bg-emerald-50/50')
                    }
                  >
                    <input
                      type={q.type === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                      name={`q-${q.id}`}
                      value={o.id}
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      className="mt-1 h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-sm leading-relaxed">{o.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={goPrev} disabled={current === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        {current < total - 1 ? (
          <Button onClick={goNext} disabled={!canAdvance}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
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

      {/* Quick-jump */}
      <div className="flex flex-wrap gap-1.5 pt-2">
        {questions.map((qq, i) => {
          const answered = (answers[qq.id] ?? []).length > 0;
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              className={
                'h-8 w-8 rounded-md text-xs font-medium border transition-colors ' +
                (i === current
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : answered
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-background text-muted-foreground hover:border-emerald-300')
              }
            >
              {answered && i !== current ? <CheckCircle2 className="h-4 w-4 mx-auto" /> : i + 1}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
