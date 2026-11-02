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
  it('rejects a single-answer question with nothing selected', () => {
    expect(isAnswerCorrect('MULTIPLE_CHOICE', [], ['a'])).toBe(false);
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
  it('rejects a multi-select answered with the wrong set of the same size', () => {
    expect(isAnswerCorrect('MULTI_SELECT', ['a', 'b'], ['a', 'c'])).toBe(false);
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
    expect(g.passed).toBe(false);
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

  it('fails one point below the pass mark', () => {
    const g = gradeQuiz(questions, { q1: ['a'], q2: ['t'], q3: ['x'] }, 68);
    expect(g.score).toBe(67);
    expect(g.passed).toBe(false);
  });

  it('returns one graded answer per question, in question order', () => {
    const g = gradeQuiz(questions, { q1: ['a'] }, 70);
    expect(g.answers).toHaveLength(3);
    expect(g.answers.map((a) => a.questionId)).toEqual(['q1', 'q2', 'q3']);
    expect(g.answers[0]!.isCorrect).toBe(true);
    expect(g.answers[1]!.isCorrect).toBe(false);
  });

  it('records what the member actually selected', () => {
    const g = gradeQuiz(questions, { q1: ['a'], q2: ['f'], q3: ['x'] }, 70);
    expect(g.answers[1]!.selectedOptionIds).toEqual(['f']);
    expect(g.answers[2]!.selectedOptionIds).toEqual(['x']);
  });
});
