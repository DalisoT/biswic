'use client';

import { useMemo, useState, useTransition } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyLearningBundleAction } from '@/server/actions/learning-admin';
import { parseBundle, planLearningImport } from '@/lib/learning-import';

/**
 * Apply a content bundle.
 *
 * The dry-run summary below is computed from the bundle alone, so it is the
 * chairman's chance to see what will happen before anything is written. The
 * bundle never deletes: a lesson it does not mention stays exactly as it is.
 */
export function AdminImportPanel() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseBundle(text), [text]);

  const preview = useMemo(() => {
    if (!parsed.ok) return null;
    // A dry run over an empty current state: it reports what the bundle
    // contains, not what will be changed in the live database.
    return planLearningImport([], parsed.bundle);
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
