import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BISWIC Learning Hub',
  description:
    'A shared lesson from the BISWIC Financial Literacy Hub — practical money lessons for Zambian civil servants and their families.',
  robots: { index: false, follow: false },
};

/**
 * The public shell for shared lessons and quizzes.
 *
 * Deliberately plain: the BISWIC wordmark, the name of the hub, and a footer
 * that tells a visitor the two things they can do next. It must not import
 * the member sidebar, top bar or mobile nav, because this layout is used by
 * people who have never signed in.
 *
 * There is no public sign-up page: BISWIC membership is opened by an existing
 * member, so the call to action says how to join rather than linking to a
 * registration form that does not exist.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="font-heading text-lg font-bold tracking-tight">
            BISWIC
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-navy-200">
            Financial Literacy Hub
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">{children}</main>

      <footer className="border-t bg-muted/40">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-8 text-sm">
          <p className="font-heading font-semibold">Enjoyed this?</p>
          <p className="text-muted-foreground">
            BISWIC is a savings and investment cooperative for serving members. Membership costs K100 a month and
            opens the full hub. To join, ask any BISWIC member or speak to the committee at the next meeting.
          </p>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-lg bg-navy-700 px-4 font-medium text-white hover:bg-navy-800"
          >
            Sign in for the full hub
          </Link>
        </div>
      </footer>
    </div>
  );
}
