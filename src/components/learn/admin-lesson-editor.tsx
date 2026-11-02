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

/**
 * Edit one lesson.
 *
 * Saving updates the lesson row in place -- the lesson keeps its id, so every
 * member's record of having completed it survives the edit.
 */
export function AdminLessonEditor({ modules }: { modules: Module[] }) {
  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const firstLessonId = allLessons[0]?.id ?? '';

  const [selectedId, setSelectedId] = useState<string>(firstLessonId);
  const [title, setTitle] = useState<string>(allLessons[0]?.title ?? '');
  const [estimatedMin, setEstimatedMin] = useState<number>(allLessons[0]?.estimatedMin ?? 5);
  const [content, setContent] = useState<string>(allLessons[0]?.content ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (id: string) => {
    setSelectedId(id);
    setSaved(false);
    setError(null);
    const lesson = allLessons.find((l) => l.id === id);
    if (lesson) {
      setTitle(lesson.title);
      setEstimatedMin(lesson.estimatedMin);
      setContent(lesson.content);
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

      {allLessons.length > 0 && (
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
