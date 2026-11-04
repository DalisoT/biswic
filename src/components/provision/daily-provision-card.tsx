import Link from 'next/link';
import { BookOpen, Quote as QuoteIcon, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface DailyProvisionView {
  dateLabel: string;
  quote: string;
  author: string | null;
  moduleTitle: string | null;
  moduleLine: string | null;
  lessonTitle: string | null;
  moduleSlug: string | null;
  lessonId: string | null;
}

/**
 * Today's provision, on the dashboard.
 *
 * One financial quote, one line from the literacy hub and the member's next
 * unfinished lesson. The same content is written to the notification bell
 * once a day, so this card is the version a member sees without opening
 * their notifications.
 */
export function DailyProvisionCard({ provision }: { provision: DailyProvisionView }) {
  const lessonHref =
    provision.moduleSlug && provision.lessonId
      ? '/learn/' + provision.moduleSlug + '/' + provision.lessonId
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <QuoteIcon className="h-4 w-4 text-gold-700" />
              Today&rsquo;s provision
            </CardTitle>
            <CardDescription className="mt-1">
              A financial quote and one lesson for today
            </CardDescription>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{provision.dateLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <blockquote className="border-l-4 border-navy-700 pl-4 font-heading text-lg leading-relaxed">
          {provision.quote}
          {provision.author ? (
            <cite className="mt-1 block text-sm not-italic text-muted-foreground">
              - {provision.author}
            </cite>
          ) : null}
        </blockquote>

        {provision.moduleLine ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              From {provision.moduleTitle}:{' '}
            </span>
            {provision.moduleLine}
          </p>
        ) : null}

        {provision.lessonTitle ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              <BookOpen className="mr-1.5 inline h-4 w-4" />
              Lesson reminder:{' '}
              <span className="font-medium">{provision.lessonTitle}</span>
            </p>
            {lessonHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={lessonHref}>
                  Finish it
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every lesson in the hub is done. Take the quizzes to close the modules.
          </p>
        )}

        <Button asChild size="sm" variant="link" className="px-0">
          <Link href="/provision">Open today&rsquo;s provision</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
