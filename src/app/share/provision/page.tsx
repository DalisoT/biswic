import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';
import { isDateKey, provisionDateKey, selectProvision } from '@/lib/daily-provision';
import { loadPublishedModules } from '@/server/services/daily-provision-service';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ date?: string }> };

export const metadata: Metadata = {
  title: 'Daily Provision · BISWIC',
  description:
    'A daily financial quote and one line from the BISWIC Financial Literacy Hub.',
  robots: { index: false, follow: false },
};

/**
 * The public face of the day's provision.
 *
 * It carries the quote and the line from the hub and nothing else: no
 * member's name, no lesson progress, nothing personal. The date in the
 * query string is validated before it reaches the date maths, and a bad
 * date simply falls back to today.
 */
export default async function SharedProvisionPage({ searchParams }: Props) {
  const sp = await searchParams;
  const requested = typeof sp.date === 'string' && isDateKey(sp.date) ? sp.date : null;
  const key = requested ?? provisionDateKey();

  const modules = await loadPublishedModules();
  const selection = selectProvision(
    key,
    modules.map((mod) => ({
      title: mod.title,
      slug: mod.slug,
      content: mod.content,
      lessons: mod.lessons.map((lesson) => ({
        title: lesson.title,
        content: lesson.content,
      })),
    })),
  );

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(key + 'T12:00:00Z'));

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">
          Daily provision
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {dateLabel}
        </h1>
      </header>

      <blockquote className="border-l-4 border-navy-700 pl-4 font-heading text-xl leading-relaxed">
        {selection.quote.text}
        {selection.quote.author ? (
          <cite className="mt-2 block text-sm not-italic text-muted-foreground">
            - {selection.quote.author}
          </cite>
        ) : null}
      </blockquote>

      {selection.moduleLine ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            From {selection.moduleTitle}:{' '}
          </span>
          {selection.moduleLine}
        </p>
      ) : null}

      <div className="rounded-lg border bg-card p-4">
        <p className="font-medium">One lesson a day finishes the hub.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          BISWIC members get a daily provision in the app, with the next lesson
          waiting for them and the next financial quote to think about.
        </p>
        <Link
          href="/login?next=/learn"
          className="mt-3 inline-flex h-11 items-center rounded-lg bg-navy-700 px-4 font-medium text-white hover:bg-navy-800"
        >
          Sign in to the hub
        </Link>
      </div>
    </article>
  );
}
