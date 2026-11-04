import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, Quote as QuoteIcon } from 'lucide-react';
import { getUser } from '@/lib/auth/require-user';
import { config } from '@/lib/config';
import { OFFICER_ROLES } from '@/lib/permissions';
import {
  ensureDailyProvisionForAll,
  ensureDailyProvisionForUser,
  getProvisionForUser,
} from '@/server/services/daily-provision-service';
import { ShareButton } from '@/components/learn/share-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Daily Provision · BISWIC',
};

/**
 * Today's provision.
 *
 * Every member sees the same quote and the same line from the literacy hub;
 * the lesson reminder is their own. The provision is written to the
 * notification bell once a day, and this page is the full version of it,
 * with a link that can be forwarded.
 */
export default async function ProvisionPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/provision');

  // An officer or the platform owner opening the platform writes the day's
  // provision for everybody at once. Everyone else writes their own.
  const isPublisher = user.isAdmin || (OFFICER_ROLES as string[]).includes(user.role);
  if (isPublisher) {
    await ensureDailyProvisionForAll();
  } else {
    await ensureDailyProvisionForUser(user.id);
  }

  const provision = await getProvisionForUser(user.id);

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const reminder = provision.reminder;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
          Daily provision
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Today&rsquo;s provision
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          One financial quote and one lesson from the hub, every day. It also lands
          in your notifications.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <QuoteIcon className="h-4 w-4 text-gold-700" />
            {dateLabel}
          </CardTitle>
          <CardDescription>
            The same provision every member sees today.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <blockquote className="border-l-4 border-navy-700 pl-4 font-heading text-xl leading-relaxed">
            {provision.selection.quote.text}
            {provision.selection.quote.author ? (
              <cite className="mt-2 block text-sm not-italic text-muted-foreground">
                - {provision.selection.quote.author}
              </cite>
            ) : null}
          </blockquote>

          {provision.selection.moduleLine ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                From {provision.selection.moduleTitle}:{' '}
              </span>
              {provision.selection.moduleLine}
            </p>
          ) : null}

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">
              <BookOpen className="mr-1.5 inline h-4 w-4" />
              Lesson reminder
            </p>
            {reminder ? (
              <>
                <p className="mt-1 font-medium">{reminder.lessonTitle}</p>
                <p className="text-sm text-muted-foreground">{reminder.moduleTitle}</p>
                <Button asChild size="sm" className="mt-3">
                  <Link href={'/learn/' + reminder.moduleSlug + '/' + reminder.lessonId}>
                    Open the lesson
                  </Link>
                </Button>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Every lesson in the hub is done. Take the quizzes to close the modules.
              </p>
            )}
          </div>

          <div>
            <ShareButton
              path={'/share/provision?date=' + provision.key}
              title="Today&rsquo;s BISWIC provision"
              label="Share today&rsquo;s provision"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              The shared page carries the quote and the line only, never your lesson.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
