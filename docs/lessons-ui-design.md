# Literacy hub — UI restyle

**Date:** 2026-11-01
**Scope:** `src/app/(authed)/learn/**` and `src/components/learn/**`

## Goal

A modern, clean look for the financial literacy hub, built for reading on a
phone. Most members will read a lesson standing up, on a cheap Android, on
mobile data. Everything below follows from that.

## What was wrong

The hub looked like a different product from the rest of the app:

| Problem | Cause |
| --- | --- |
| Every lesson rendered its title twice | The page header shows the title and the body opens with a markdown `# Heading` repeating it (15 of 17 lessons exactly, 2 near-verbatim) |
| Nine tables rendered as raw pipe soup | The mini markdown renderer had no table support |
| `prose prose-sm sm:prose-base` did nothing | `@tailwindcss/typography` is not a dependency, so no `.prose` rule exists in the built CSS |
| Top bar showed `415D3B94 0D36 4FD6 A766 558B73224339` | `ROUTE_TITLES` had no `/learn` entry, so the fallback titleized the lesson id |
| Emerald everywhere | The hub used emerald while the app brand is navy `#0a3a5c` + gold `#d88621` |
| Lesson titles truncated | `truncate` on a one-line row |
| Quick-jump buttons were 32px | Below the 44px touch floor the project already sets |
| Two headers on every page | The app TopBar plus a `bg-card/50 backdrop-blur` page header whose blur did nothing (it is not sticky) |
| Double padding | Layout gives `px-4 md:px-8`; learn pages added `px-4 sm:px-6` on top |

## Decisions

### Keep the app chrome

The learn pages stay inside `src/app/(authed)/learn/**`. The sidebar, the top
bar and the phone tab bar are all still there, and the pages still require
sign-in. A public-hub variant was considered and dropped.

The `(authed)` layout gate must stay mandatory: `claims/new`, `group` and
`soft-loans/apply` have no auth call of their own and rely on the layout
alone.

### Colour roles

| Colour | Role |
| --- | --- |
| Navy `#0a3a5c` | Structure — links, primary buttons, table headers, focus rings, progress bars |
| Gold `#d88621` | The hub's identity — eyebrows, module numbers, "up next", the quiz call to action |
| Emerald | Success only — completed, passed, correct, 100% |
| Amber | Warning only — a failed quiz, a retry |

Flat `bg-background` everywhere. The old mint page gradients are gone.

### One stylesheet block for lesson content

`@tailwindcss/typography` stays uninstalled. The new `.lesson-content` class
in `src/app/globals.css` styles the rendered markdown instead, and the
markdown renderer now emits **plain semantic HTML with no utility classes**.

That matters for a second reason: Tailwind only scans `src/app`,
`src/components` and `src/pages`, so utility classes emitted from `src/lib`
were never generated in the CSS. The old renderer's `text-emerald-700` and
`border-emerald-300` only worked by accident, because those same classes
happened to appear somewhere else in the app.

### Markdown renderer

- Pipe tables become real `<table>` elements inside a `.scroll-x` wrapper,
  with alignment read from the separator row.
- `stripLeadingHeading()` drops the leading `# Heading` from a lesson body.
- Inline code is lifted out before bold/italic parsing, so `` `**not bold**` ``
  stays literal.
- Link targets are limited to `http(s)`, `mailto`, `/` and `#`.
- No utility classes in the output.

### Page structure

Each learn page is now: a compact header (eyebrow, title, one supporting
line, metadata) → content → actions. No second bordered band, no gradient
wrapper, no page-level `min-h-screen`.

The "About this module" card only renders when the module carries content
beyond its summary. In the live data the module content *is* the summary, so
the card disappears instead of repeating the header.

### Mobile

- Lesson rows are at least 64px and their titles wrap rather than truncate.
- Quiz options are at least 52px with 20px radios.
- Quick-jump buttons are 44×44.
- The lesson nav bar and the quiz Next/Submit bar are pinned to the bottom of
  the screen on a phone, and sit in the flow on desktop.

The pinned bar is `position: fixed`, not `sticky`. A sticky element only pins
while its natural position is still below the viewport, so a bar that is the
last child of the page would not appear until you reached the end of the
lesson. The bar's bottom offset clears the app's own fixed phone tab bar via
`--mobile-nav-h`.

### Top bar titles

`/learn` → "Literacy Hub" and `/learn/me` → "My Learning". The existing
longest-prefix match covers the deeper lesson and quiz routes, so the lesson
id never reaches the title bar.

`deriveTitle()` moved to `src/lib/route-titles.ts` so it can be unit tested
without pulling a client component into the test environment. As a safety net
for other dynamic routes, a last segment that looks like a record id now
falls back to the parent segment.

## Files

| File | Change |
| --- | --- |
| `src/lib/utils-markdown.ts` | Pipe tables, `stripLeadingHeading`, semantic output, safe link targets |
| `src/lib/route-titles.ts` | **New** — route → page title, extracted from the TopBar |
| `src/app/globals.css` | `.lesson-content` typography, `.learn-action-bar`, `--mobile-nav-h` |
| `src/components/layout/topbar.tsx` | Imports `deriveTitle` from the new module |
| `src/app/(authed)/learn/page.tsx` | Hub: compact header, 3-up stat strip, gold number squares |
| `src/app/(authed)/learn/[slug]/page.tsx` | Module: gold chip, ≥64px lesson rows, conditional "about" card, gold quiz CTA |
| `src/app/(authed)/learn/[slug]/[lessonId]/page.tsx` | Lesson: borderless content column, pinned action bar |
| `src/app/(authed)/learn/[slug]/quiz/page.tsx` | Quiz intro |
| `src/app/(authed)/learn/[slug]/quiz/result/page.tsx` | Result: score card, clean per-question review |
| `src/app/(authed)/learn/me/page.tsx` | 2×2 stat grid on mobile, module progress list |
| `src/components/learn/quiz-runner.tsx` | 20px radios, ≥52px options, 44px quick-jump, pinned Next/Submit |
| `src/components/learn/mark-complete-button.tsx` | Full-width primary on mobile |
| `tests/unit/markdown.test.ts` | **New** — 19 cases |
| `tests/unit/route-titles.test.ts` | **New** — 9 cases |

## Not done, on purpose

- **Dark mode.** Nothing sets the `dark` class on `<html>` yet, so the hub is
  light-only. The new CSS blocks carry a dark-mode override anyway, ready
  for when a theme toggle lands.
- **The three `(authed)` pages with no auth call of their own.** Out of
  scope for a styling pass, but worth fixing before the layout gate ever
  becomes optional.
