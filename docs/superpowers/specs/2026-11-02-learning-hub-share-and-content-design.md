# Learning Hub: shared lessons and a content refresh

**Date:** 2 November 2026
**Status:** approved by the chairman
**Repo:** `DalisoT/biswic` (`https://github.com/DalisoT/biswic`)

---

## 1. Why this is being built

The BISWIC Financial Literacy Hub has 10 published modules, 17 lessons and 10 quizzes
(45 questions). Two things are missing.

**There is no way to share a lesson.** Every route under `/learn` sits inside the
`(authed)` route group, whose layout calls `requireUser()`. A member who wants to send
a colleague a lesson can only send a URL that dead-ends at the sign-in page. The hub
is the platform's best recruitment and retention asset — a lesson a member reads on
their phone and forwards to a friend is worth more than any member's monthly
contribution — and right now that moment is wasted.

**The lesson content has drifted.** The library was written in October 2026. It covers
the right subjects but the figures are thin, several lessons lean on generic advice,
and there are gaps: a Zambian civil servant household is not taught how to buy land
safely, how to protect their family if they die, or how to turn a skill into income.
There is also no way to change a lesson's wording once it is in the database.

## 2. What the chairman decided

| Decision | Answer |
| --- | --- |
| Who can open a shared lesson | Anyone, no account needed |
| A visitor who is not a member taking a shared quiz | Allowed, scored in the browser, nothing stored |
| Content scope | Rewrite all 17 existing lessons and add 3 new modules |
| Research focus | Let the research identify the biggest gaps |
| How content reaches the live database | An admin learning editor inside the app |

## 3. Constraints that shape the design

**No schema migration is possible.** `prisma migrate deploy` is not part of the Vercel
build script (`check:secrets && prisma generate && tsc --noEmit && vitest run && next
build`), there is no `vercel.json` build hook, and this machine has no `DATABASE_URL`.
A new column would never reach the live database and every query touching it would
fail at runtime. **Everything in this design works with the schema exactly as it
stands.** Any idea that needs a column is out.

**The learning seeds destroy member progress.** `prisma/seed-learning.ts` and
`prisma/seed-learning-zambia.ts` both call `learningLesson.deleteMany({ where: { moduleId } })`.
`LessonProgress.lesson` has `onDelete: Cascade`, so deleting the lessons deletes every
member's record of which lessons they have completed. `quiz.deleteMany` does the same
to that module's quiz attempts. Re-running the seeds as they stand would reset the
"6 of 17 lessons complete" and every quiz score on the register. **Content changes
must be updates in place, never delete-and-recreate.**

**Deploys are slow.** A Vercel build of this project currently sits in a queue of
roughly an hour behind a push. Everything that can be built in one commit should be
built in one commit.

## 4. Goals and non-goals

### Goals

1. A member can share any lesson and any module quiz as a link that opens in a browser
   with no account, on a phone, with a readable WhatsApp preview.
2. A visitor can read the shared lesson and take the shared quiz, and see their score
   and the explanation for each answer.
3. A signed-in member who opens a shared quiz still gets the attempt recorded against
   their account.
4. The chairman can edit any lesson's wording himself, and can apply a bulk content
   bundle, without touching a database.
5. All 17 existing lessons are rewritten with researched, current, sourced content, and
   three new modules are added.
6. No member loses lesson progress or quiz history as a result of this work.

### Non-goals

- The hub index, module pages and "My Learning" stay behind sign-in. Only an
  explicitly shared lesson or quiz is public.
- The ten existing quizzes are not changed. Their questions, options and answers stay
  exactly as they are, so no member's score is disturbed.
- No share analytics, no share-token revocation, no expiry, no view counter.
- No public search engine indexing of lesson content. Shared pages set `noindex`.
- No changes to the learning module/lesson/quiz schema.

## 5. The share feature

### 5.1 Routes

Three new files, all **outside** the `(authed)` group so no layout auth gate applies:

```
src/app/share/layout.tsx                              public shell
src/app/share/learn/[slug]/[lessonId]/page.tsx       a shared lesson
src/app/share/learn/[slug]/quiz/page.tsx              a shared module quiz
```

`src/app/share/layout.tsx` is deliberately plain: the BISWIC logo, the words
"Financial Literacy Hub", the shared item's own title, and a footer with a
**"Join BISWIC"** call to action and a **"Sign in for the full hub"** link. It must not
import the member sidebar, top bar or mobile nav.

### 5.2 URLs

```
/share/learn/<module-slug>/<lesson-uuid>     a lesson
/share/learn/<module-slug>/quiz              that module's quiz
```

The lesson is identified by its UUID, not by its position in the module. A positional
URL is prettier, but if a lesson is ever reordered an old shared link would silently
open a *different* lesson. A UUID either resolves or 404s. The URL is always produced
by the "Copy link" button and never typed, so its length is a non-issue.

### 5.3 Access rules

A shared page is served only when:

- the module exists and `isPublished` is true; otherwise `notFound()`;
- the module's `audience` includes `MEMBER`. Every current module lists every role, so
  all ten are shareable. A module later restricted to officers alone is not shareable
  and its shared URL 404s. This keeps the existing audience system meaningful.

The shared lesson page renders the lesson body and the module title. It does **not**
list the module's other lessons: a shared link exposes one lesson, not the hub.

### 5.4 The Share button

A new client component `src/components/learn/share-button.tsx`.

- On the member lesson page (`/learn/[slug]/[lessonId]`) it shares that lesson.
- On the member quiz page (`/learn/[slug]/quiz`) it shares that module's quiz.
- On click: if `navigator.share` exists (phones — this is the WhatsApp path) open the
  native share sheet with the title and URL. Otherwise copy the URL to the clipboard
  and show a toast: "Link copied".
- The toast always shows the full URL so the member can copy it by hand if the share
  sheet is not available.
- The button states which link it is sharing ("Share lesson" / "Share quiz").

### 5.5 Link preview

Both shared pages export `generateMetadata` returning the title, the module summary as
the description, and Open Graph tags, so a link pasted into WhatsApp renders a preview
card with the lesson title rather than a bare URL. `robots: { index: false }` keeps the
pages out of search engines.

### 5.6 The shared quiz

The shared quiz page resolves the signed-in user with `getUser()` — the same helper the
member lesson page already uses — and branches:

**Signed in.** The existing server-graded path: `startQuizAttemptAction` and
`submitQuizAttemptAction` create a real attempt, the score is stored, and the member's
"best score" updates exactly as it does in the hub. The "finish every lesson first"
gate that `/learn/[slug]/quiz` enforces is **not** applied on the shared route — a
shared quiz is deliberately sent to people who have not done the lessons, and the gate
would make the shared link useless. The gate lives in the page, not in the action, so
nothing else has to change.

**Not signed in.** Guest mode. The page renders the questions, the options and the
answer key, and the quiz is graded in the browser. Nothing is written: no member
record, no attempt row, no answers. The page says plainly: *"You are not signed in, so
this result is not saved."*

### 5.7 The trade-off in guest mode, stated plainly

A guest attempt is graded in the browser, so **the answer key is visible to anyone who
opens the shared quiz link**. That is inherent in "scored but not stored" — to score
without storing, the correct answers must reach the browser.

The alternative would be to store something server-side for the visitor, which means
making `QuizAttempt.userId` optional — a schema migration, which section 3 rules out.
The member quiz is unaffected: it stays server-graded and the key never leaves the
server.

For a literacy quiz that carries no examination stakes, this is the right trade. It is
recorded here so the committee is not surprised later.

### 5.8 The quiz runner change

`src/components/learn/quiz-runner.tsx` gains one optional prop:

```ts
guestMode?: boolean
```

- `false` (default) — exactly today's behaviour: start an attempt, submit it, redirect
  to the result page.
- `true` — grade locally. `QuizRunner` receives the correct option ids alongside the
  questions, marks each answer, and renders the score and the per-question
  explanation on the page instead of redirecting.

The score maths must match the server exactly, so it lives in a small pure module
`src/lib/quiz-grading.ts` that both the server action and the guest mode call. One
implementation, two callers, one set of unit tests.

## 6. The admin learning editor

New page `src/app/(authed)/admin/learning/page.tsx`, reachable only by `user.isAdmin`
or an officer role — the same guard `src/app/(authed)/admin/lockouts/page.tsx` uses.
Non-admins are redirected to `/dashboard`.

It has two panels.

### 6.1 Lesson editor

Lists every module and, under each, its lessons. Selecting a lesson opens a form with
three fields: **title**, **estimated minutes**, and the **markdown body** in a large
textarea. Saving runs an action that performs a single `update` on that lesson row.

Because it is an update, the lesson keeps its id, and every member's
`LessonProgress` row for it survives. The audit trail records the edit with the
editor's name, the lesson, and the before/after title and length.

### 6.2 Bulk import

A panel that accepts a JSON bundle:

```jsonc
{
  "modules": [
    {
      "slug": "housing-and-land-finance",
      "title": "...",
      "summary": "...",
      "audience": ["MEMBER", "CHAIRPERSON", "..."],
      "order": 16,
      "isPublished": true,
      "lessons": [
        { "order": 1, "title": "...", "content": "# ...markdown...", "estimatedMin": 8 }
      ],
      "quiz": {
        "passMark": 70,
        "questions": [
          { "order": 1, "prompt": "...", "type": "MULTIPLE_CHOICE",
            "options": ["...", "..."], "correct": [0], "explanation": "..." }
        ]
      }
    }
  ]
}
```

**The apply rules, and they are the whole point of this panel:**

1. Modules are matched by `slug`. A slug that exists is **updated in place**; a slug
   that does not exist is **created**.
2. Lessons inside a module are matched by `order`. A lesson with that order exists →
   **update it in place**. It does not exist → **create it**.
3. **Nothing is ever deleted.** No `deleteMany` anywhere in the import path. A lesson
   that the bundle omits simply stays as it is.
4. A quiz is only created or replaced when the bundle includes one, and only for a
   module whose quiz does not already exist. For the ten existing modules the bundles
   carry no quiz, so their quizzes and every member's attempt history are untouched.
5. The panel shows a **dry-run summary** first — "3 modules updated, 3 created, 17
   lessons updated, 9 lessons created, 0 deleted" — and the chairman confirms before
   anything is written.

The importer is a pure function over a small interface so the matching rules can be
unit tested without a database: given the current modules and the bundle, what would
be created, updated and left alone?

## 7. The content work

### 7.1 Research

A research pass establishes the current Zambian position, with a source URL and the
date checked for every figure: PAYE bands and what changed; NAPSA contribution and
benefits; mobile money fees and the rules that changed; bank charges and deposit
rates; consumer and SACCO loan rates and credit scoring; land prices, title fees and
housing finance; insurance and funeral policies; the scams actually operating in
Zambia now; PACRA and ZRA registration and tax thresholds; co-operative law and member
rights; and money-behaviour evidence on why savings fail.

The research output is committed as `docs/learning-hub-research-2026-11.md` so every
figure in the lessons can be traced back to a source and a date.

### 7.2 Rewriting the 17 existing lessons

Constraints, all of which protect members:

- **The number of lessons in each module does not change.** A new lesson in the middle
  would shift the `order` of every lesson after it, and matching by order would then
  write the wrong body onto the wrong lesson.
- **The order does not change.**
- **The module count does not change** (the 3 new modules are additions).

So each existing lesson is rewritten **in place**, keeping its identity, its position
and its id. A member who has already completed a lesson keeps that progress against
the improved text.

What changes in the body: the figures become current and sourced, the worked examples
use real numbers, generic advice is replaced with Zambian specifics, and each lesson
ends with a "**What to do this week**" box of two or three concrete actions and a
"**Where to check**" line naming the institution to verify the figures against.

The house style is kept: plain English, short sections, pipe tables, an H1 opening
each, roughly 2,000–5,000 characters per lesson.

### 7.3 Three new modules

Chosen from the research's "biggest content gaps", with a lesson each (three lessons
for the richest topic), a summary, and its own quiz. My starting candidates, to be
confirmed against the research:

1. **Housing and land finance** — NHCC and National Housing Authority loan schemes,
   what a modest house actually costs to build, land prices, title and deed fees,
   ground rent, and the checks to make before paying a land instalment.
2. **Protecting your family** — life, health, education and funeral cover, how a claim
   is actually paid, National Health Insurance, and what happens to a household when
   the breadwinner dies.
3. **Turning a skill into income** — PACRA registration and what it costs, ZRA
   registration and the thresholds below which no tax is due, mobile-money business
   fees, and the five records every small business keeps.

Each new module ships with a quiz, because a module without one breaks the hub's
"a quiz at the end of every module" promise.

### 7.4 The existing quizzes

Untouched. Their questions, options, correct answers and pass marks stay exactly as
they are, so no member's score or attempt history changes. Expanding them later is
possible — the importer can replace a quiz's questions — and that would clear the
stored per-question answers for that quiz while leaving the attempt scores, but it is
not part of this work.

## 8. Data flow

**Sharing.** The member opens a lesson → presses "Share lesson" → the client builds
`/share/learn/<slug>/<lessonId>` from `window.location.origin` → native share sheet or
clipboard.

**A visitor opens a shared lesson.** Public route → module lookup by slug → module must
be published and audience-compatible → lesson lookup by id within that module → markdown
rendered → metadata emitted.

**A visitor takes a shared quiz.** Public route → module and quiz lookup → questions,
options and (in guest mode) the answer key are serialised into the page → the client
marks each answer with `gradeQuiz` from `src/lib/quiz-grading.ts` → the score and the
explanations are shown. Nothing is written.

**A member takes a shared quiz.** The same page, but `getUser()` returns a user → the
page renders `QuizRunner` in server mode → the existing actions create and grade the
attempt → the result page shows the score.

**Content is updated.** The chairman opens `/admin/learning` → picks a lesson → edits
the markdown → saves → the action updates that lesson row and writes an audit entry.
For a bulk refresh: the chairman opens the bulk panel → pastes the bundle → sees the
dry-run summary → confirms → the importer applies it → the audit log records it.

## 9. Error handling

| Case | Behaviour |
| --- | --- |
| Shared link for an unpublished module | 404 |
| Shared link for a module restricted to officers | 404 |
| Shared link for a lesson id that does not exist | 404 |
| Shared link for a lesson that belongs to a different module | 404 |
| Clipboard copy fails (no permission) | Toast shows the URL so it can be copied by hand |
| Native share sheet cancelled by the user | No toast, no error — nothing was shared |
| Guest quiz with no questions in the module | "This quiz has no questions yet." |
| Bulk import with malformed JSON | The error names the position; nothing is written |
| Bulk import naming a module that does not exist | Created, and listed in the summary as created |
| Bulk import with a lesson order that already exists | Updated in place, listed as updated |
| Bulk import with a lesson order that does not exist | Created, listed as created |
| Non-admin opens `/admin/learning` | Redirected to `/dashboard` |
| A member's progress exists for a lesson whose body changed | Progress is untouched — same lesson id |

## 10. Testing

**New unit tests**

- `tests/unit/quiz-grading.test.ts` — the shared grading module. The same inputs must
  produce the same score as the existing server-side path, including multi-select
  partial-credit rules and the pass mark. This is the test that proves guest mode and
  member mode cannot drift apart.
- `tests/unit/learning-import.test.ts` — the importer's matching rules: update by slug,
  create by slug, update lesson by order, create lesson by order, **never delete**, and
  a module with no quiz in the bundle leaves its quiz alone.

**Existing suite** — all 174 tests must still pass, plus the new ones.

**Static checks** — `tsc --noEmit` clean, `next lint` with no new errors, `next build`
green.

**Live verification** — on the deployed site: a shared lesson opens in a private window
with no session; the guest quiz grades and explains; a signed-in member's shared-quiz
attempt appears in "My Learning"; the Share button copies a working URL; the admin
editor saves a lesson and the change is visible in the hub; a bulk import applies and
the dry-run summary is accurate; and the members' existing progress is unchanged
(the chairman's own record should still read "6 of 17 lessons complete" before the new
modules land, then the same 6 of a larger total).

## 11. Sequencing

1. **Build** the share feature and the admin learning editor, and commit them
   **together** — one deploy, not two, because a deploy currently costs an hour of
   queue time.
2. **Research** runs in parallel with the build.
3. **Deploy.** Confirm the shared pages and the admin editor are live.
4. **Apply the content** through the admin editor's bulk import — no further deploy is
   needed for content changes.
5. **Verify** the hub: 13 modules, the rewritten lessons, the new modules, member
   progress intact.
6. **Commit** the research document.

## 12. Risks and accepted trade-offs

| Risk | Severity | Handling |
| --- | --- | --- |
| The guest answer key is visible to anyone with the link | Accepted | Inherent in "scored but not stored"; the member quiz is unaffected. Recorded in section 5.7 |
| A bulk import writes the wrong body onto a lesson | High | Dry-run summary before writing; the importer refuses to delete; lessons are matched by module slug **and** order, and the bundle carries both |
| The import wipes member progress | High | The importer contains no delete at all. The progress check in section 10 is the proof |
| A shared link exposes a module that should stay internal | Medium | The audience rule gates every shared page; a module restricted to officers cannot be shared |
| Deploy queue delays everything | Medium | One combined commit; content applied through the app rather than another deploy |
| The research states a figure that is out of date | Medium | Every figure carries a source and a checked date; anything unverified is flagged in the research file and not stated as fact in a lesson |
| Existing quizzes become stale relative to the rewritten lessons | Low | Deliberate. The quizzes still test the same subjects; they are not touched in this work |

## 13. Out of scope

Share analytics and view counts; revocable or expiring share links; a public module
index; search-engine indexing of lessons; a WYSIWYG markdown editor (a plain textarea
is enough); editing quizzes in the admin UI in this round; a full CMS with roles and
draft states; publishing the five unpublished co-operative modules that exist in
`prisma/seed-learning.ts` (`why-we-save-together`, `reading-your-statement`,
`soft-loans-101`, `welfare-claims`, `preparing-for-agm`) — they are not published today
and publishing them is a separate decision.

## 14. Files

**New**

```
src/app/share/layout.tsx
src/app/share/learn/[slug]/[lessonId]/page.tsx
src/app/share/learn/[slug]/quiz/page.tsx
src/components/learn/share-button.tsx
src/components/learn/guest-quiz.tsx
src/lib/quiz-grading.ts
src/lib/learning-import.ts
src/app/(authed)/admin/learning/page.tsx
src/components/learn/admin-lesson-editor.tsx
src/components/learn/admin-import-panel.tsx
tests/unit/quiz-grading.test.ts
tests/unit/learning-import.test.ts
docs/learning-hub-research-2026-11.md
docs/superpowers/specs/2026-11-02-learning-hub-share-and-content-design.md
```

**Changed**

```
src/components/learn/quiz-runner.tsx            guestMode prop
src/app/(authed)/learn/[slug]/[lessonId]/page.tsx   Share button
src/app/(authed)/learn/[slug]/quiz/page.tsx         Share button
src/server/actions/learn.ts                     grading via the shared module
src/components/layout/sidebar.tsx               admin link
```

**Not changed**

`prisma/schema.prisma`, every file under `prisma/migrations/`, and the ten existing
quizzes.
