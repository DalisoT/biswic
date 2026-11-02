/**
 * Quiz grading rules, in one place.
 * ---------------------------------------------------------------------------
 * The member quiz grades on the server and the shared quiz grades in the
 * browser. If those two implementations ever differed, a member's score in the
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
  /** 0-100, rounded to the nearest whole percent. */
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  answers: GradedAnswer[];
}

/**
 * Is this answer right for this question type?
 *
 * `correctOptionIds` may be empty (a question with no correct option marked),
 * in which case nothing the member picks can be right.
 */
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

/**
 * Grade a whole quiz.
 *
 * `answers` maps a question id to the option ids the member chose. A question
 * with no entry was not answered, and counts as wrong.
 */
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
