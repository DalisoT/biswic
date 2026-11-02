# Move a payment to another month — design

**Date:** 2 November 2026
**Status:** approved (Approach A)
**Scope:** one feature, three files plus two edits

## The problem

A contribution is booked against the month it belongs to, not the month the
money landed. On 1 and 2 November 2026 four members paid money that belongs to
**October 2026**, and the ledger booked all four under **November 2026**. Each
of them therefore showed as owing October.

The ledger had no way to correct this. `src/server/actions/contributions.ts`
offered `addContributionAction`, `bulkImportPayrollAction` and
`getMonthlyContributionStats` — there was no way to change the month on a
payment that had already been recorded.

Three ways out were considered:

| Option | Verdict |
| --- | --- |
| **A. Move the payment to another month** | **Chosen.** Updates the existing ledger row in place. No schema change, no deleted rows, reusable for any future mis-booked payment. |
| B. Allow several payments per member per month | Not possible. It needs a `prisma migrate deploy` in the Vercel build script and a `DATABASE_URL`; this project has neither, so the migration could not be run or verified. |
| C. Delete the November row and re-add it as October | Works, but breaks the standing rule that no ledger row is ever hard-deleted, and loses the receipt trail for that payment. |

## What a move does

The existing ledger row is **updated in place**. Only `month` and `year`
change:

- the amount, the payment method, the date the money was received, the
  receipt number and the bucket allocations are all left untouched;
- the row is never deleted;
- an audit-log entry records the period before and after, who made the move
  and which member it was for;
- the member is notified that their payment now stands for the corrected
  month, so their notification trail does not contradict the ledger.

## Rules

Enforced in `src/lib/contribution-move.ts`, a pure module with unit tests:

1. The target month must not be the month the payment is already booked for.
2. The target month must not be before the month the member became liable
   (`firstLiableMonth` — the founding month for founding members, the joining
   month for everyone else). This is the same rule the payroll import and the
   single-contribution form already apply.
3. The member must not already have a payment booked for the target month.
   The ledger allows one payment per member per month.

A month **after** the member left is allowed. The arrears engine already
reports money outside a member's liability window on its own line, so it is
neither lost nor silently swallowed.

## Permission

`canActAs(user, canRecordContributions)` — the same permission as recording
a payment: Treasurer, Deputy Treasurer, Finance Warrant, plus the platform
owner's admin override.

## Screen

`/finance/contributions` gains an **Adjust** column. Each row carries a small
control that opens a month and year picker and moves the payment. The control
is only rendered for people who may record contributions. The row leaves the
current month's list once it moves, which is the clearest possible confirmation
that the move worked.

## What changes on the live platform

Four payments move from November 2026 to October 2026:

| | Before | After |
| --- | --- | --- |
| October rows / cash | 25 · K2,500 | 29 · K2,900 |
| November rows / cash | 4 · K400 | 0 · K0 |
| Total received | K17,200 | K17,200 |
| Expected | K33,400 | K33,400 |
| Arrears | K16,700 | K16,700 |
| Compliance | 50% | 50% |

The four stop owing October and start owing November instead, which is what
the report already says. **The monthly figures in
`docs/contributions-status-report-2026-11.md` are re-verified against the live
platform after the moves and corrected.**

## Out of scope

- Moving an amount. Only the period can be corrected.
- Splitting one payment across several months.
- Any change to the arrears engine.
- Editing a payment's method, date or receipt number.
