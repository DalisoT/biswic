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

  it('never deletes anything, even when the bundle covers fewer lessons', () => {
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

  it('never replaces an existing quiz, even when the bundle carries one', () => {
    const withQuiz = {
      modules: [
        {
          ...bundle.modules[0]!,
          quiz: {
            title: 'Quiz',
            passingScore: 70,
            questions: [
              {
                order: 1,
                prompt: 'Q?',
                type: 'MULTIPLE_CHOICE',
                options: [{ text: 'A', correct: true, order: 1 }],
              },
            ],
          },
        },
      ],
    };
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1, 2], hasQuiz: true }],
      withQuiz,
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
              {
                order: 1,
                prompt: 'Q?',
                type: 'MULTIPLE_CHOICE',
                options: [{ text: 'A', correct: true, order: 1 }],
              },
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

  it('reports nothing to do for an empty bundle', () => {
    const plan = planLearningImport(
      [{ slug: 'existing-module', lessonOrders: [1], hasQuiz: true }],
      { modules: [] },
    );
    expect(plan.modules).toHaveLength(0);
    expect(plan.totals.deleted).toBe(0);
    expect(plan.totals.modulesUpdated).toBe(0);
  });

  it('leaves a module the bundle does not mention entirely alone', () => {
    const plan = planLearningImport(
      [{ slug: 'other-module', lessonOrders: [1, 2, 3], hasQuiz: true }],
      bundle,
    );
    expect(plan.modules).toHaveLength(1);
    expect(plan.modules[0]!.slug).toBe('existing-module');
    expect(plan.totals.deleted).toBe(0);
  });
});

describe('parseBundle', () => {
  it('rejects malformed JSON with a readable error', () => {
    const result = parseBundle('{ not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it('rejects a bundle with no modules array', () => {
    const result = parseBundle('{"nope": true}');
    expect(result.ok).toBe(false);
  });

  it('rejects a module with no slug', () => {
    const result = parseBundle(
      JSON.stringify({ modules: [{ title: 'x', lessons: [] }] }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a module with no lessons array', () => {
    const result = parseBundle(JSON.stringify({ modules: [{ slug: 'x' }] }));
    expect(result.ok).toBe(false);
  });

  it('rejects a lesson with no numeric order', () => {
    const result = parseBundle(
      JSON.stringify({
        modules: [
          { slug: 'x', lessons: [{ title: 'L', content: 'c' }] },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('accepts a well-formed bundle', () => {
    const result = parseBundle(JSON.stringify(bundle));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bundle.modules).toHaveLength(1);
  });
});
