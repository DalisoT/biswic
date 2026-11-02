'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { CloudDownload, FileUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyLearningBundleAction } from '@/server/actions/learning-admin';
import { parseBundle, planLearningImport } from '@/lib/learning-import';

type BundleEntry = { file: string; label: string };

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

  const [manifest, setManifest] = useState<BundleEntry[]>([]);
  const [bundleFile, setBundleFile] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/learning-bundles/index.json')
      .then((r) => (r.ok ? r.json() : { bundles: [] }))
      .then((data: { bundles?: BundleEntry[] }) => {
        if (!cancelled) setManifest(data.bundles ?? []);
      })
      .catch(() => {
        if (!cancelled) setManifest([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  /** Pull one of the centrally kept bundles off the server and into the box. */
  const loadFromServer = async () => {
    if (!bundleFile) return;
    setError(null);
    setApplied(null);
    try {
      const res = await fetch(`/learning-bundles/${bundleFile}`);
      if (!res.ok) throw new Error(`the server returned ${res.status}`);
      const body = await res.text();
      setText(body);
    } catch (err) {
      setError(`Could not load ${bundleFile}: ${(err as Error).message}`);
    }
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
        Load one of the centrally kept bundles, paste your own, or load a JSON file. Lessons are matched by module
        slug and lesson order. Nothing is deleted, and members keep their progress.
      </p>

      {manifest.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          <label className="min-w-[240px] flex-1 text-sm font-medium">
            Bundle kept on the server
            <select
              value={bundleFile}
              onChange={(e) => setBundleFile(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Choose a bundle…</option>
              {manifest.map((b) => (
                <option key={b.file} value={b.file}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={loadFromServer} disabled={!bundleFile}>
            <CloudDownload className="mr-2 h-4 w-4" />
            Load it
          </Button>
        </div>
      )}

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
