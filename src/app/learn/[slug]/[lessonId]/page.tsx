import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth/require-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { renderMarkdown } from '@/lib/utils-markdown';
import { MarkCompleteButton } from '@/components/learn/mark-complete-button';

export const dynamic = 'force-dynamic';

function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

export default async function LessonPage({
  params,
}: {
  params: { slug: string; lessonId: string };
}) {
  const user = await getUser();

  const lesson = await prisma.learningLesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: {
        include: { lessons: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!lesson || lesson.module.slug !== params.slug) notFound();
  if (!lesson.module.isPublished) notFound();
  if (
    !isAudienceMatch(lesson.module.audience, user?.role ?? 'MEMBER', user?.isAdmin ?? false)
  ) {
    notFound();
  }

  const lessonIndex = lesson.module.lessons.findIndex((l) => l.id === lesson.id);
  const prev = lessonIndex > 0 ? lesson.module.lessons[lessonIndex - 1] : null;
  const next = lessonIndex < lesson.module.lessons.length - 1 ? lesson.module.lessons[lessonIndex + 1] : null;

  let completed = false;
  if (user) {
    const p = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    });
    completed = !!p;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
            <Link href={`/learn/${lesson.module.slug}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {lesson.module.title}
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Lesson {lesson.order}</Badge>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lesson.estimatedMin} min
            </span>
            {completed && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading mt-2">{lesson.title}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div
              className="prose prose-sm sm:prose-base max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }}
            />
          </CardContent>
        </Card>

        {/* Mark complete + nav */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {prev ? (
            <Button asChild variant="outline">
              <Link href={`/learn/${lesson.module.slug}/${prev.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous: {prev.title}
              </Link>
            </Button>
          ) : (
            <div />
          )}

          {user && (
            <MarkCompleteButton lessonId={lesson.id} initialComplete={completed} />
          )}
        </div>

        {next && (
          <Card className="bg-emerald-50/40 border-emerald-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Up next</p>
                <p className="font-medium">{next.title}</p>
              </div>
              <Button asChild>
                <Link href={`/learn/${lesson.module.slug}/${next.id}`}>
                  Next lesson
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!next && (
          <Card className="bg-emerald-50/40 border-emerald-200">
            <CardContent className="p-4 text-center">
              <p className="font-medium text-emerald-700">🎉 You've finished all the lessons!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Take the end-of-module quiz to test your understanding.
              </p>
              <Button asChild className="mt-3">
                <Link href={`/learn/${lesson.module.slug}/quiz`}>
                  {completed ? 'Retake quiz' : 'Start quiz'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
