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
          [question.id]: cur.includes(optionId)
            ? cur.filter((x) => x !== optionId)
            : [...cur, optionId],
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
                  let tone = 'border bg-background hover:border-navy-300';
                  if (submitted) {
                    if (o.isCorrect) tone = 'border-emerald-300 bg-emerald-50';
                    else if (chosen) tone = 'border-red-300 bg-red-50';
                  } else if (chosen) {
                    tone = 'border-navy-500 bg-navy-50';
                  }
                  return (
                    <li key={o.id}>
                      <label
                        className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-lg border p-3 ${tone}`}
                      >
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
            <a href="/login" className="font-medium underline">
              Sign in
            </a>{' '}
            to keep your scores and unlock the rest of the hub. To join BISWIC, ask any member or speak to the
            committee.
          </p>
        </div>
      )}
    </div>
  );
}
