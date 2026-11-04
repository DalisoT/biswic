# BISWIC — Contributions Status Report

**Reporting period:** 22 July 2026 (founding) to 4 November 2026
**Prepared for:** The Chairman and Committee of the Brothers in Service Welfare, Land & Investment Cooperative
**Prepared:** 1 November 2026 · re-verified 2 November 2026 · **re-verified again on 4 November 2026, after seven ledger corrections**
**Source:** BISWIC member platform (live ledger) and the contributions report

> November contributions were still being recorded as this report was written, so the figures move during the month.

---

## 1. Summary

Since the cooperative was founded on 22 July 2026, **K17,100** has been collected from members against an expected
**K33,400** for the five months July–November 2026. **K16,300** is outstanding, spread across 163 member-months,
giving a compliance rate of **51%**.

**The ledger was corrected on 4 November 2026, and the position is now clean.** Seven corrections were applied through
the platform itself, every one of them recorded in the audit log with a written reason (section 3):

- **One payment that was never made was voided** — a row for Mwansa Jacob's October 2026 subscription that had been
  inserted by a script so that he could pass the good-standing check at sign-in. No money was ever received for it.
- **One payment that had been voided by mistake was put back**, exactly as it was originally recorded — CHAMA J's
  August K100. He paid it; it was a real receipt.
- **Four lump payments were split across the months they actually cover**, so that every member who paid two or three
  months at once is now credited for each of those months.

**The practical result is that both anomalies are gone.** The K500 that was received from three members for months
before they joined, and the K500 that was paid ahead of the month it was booked against, are **both now K0**. Every
kwacha on the ledger cancels a month that was actually owed: K33,400 expected − K17,100 received = K16,300, which is
exactly the arrears. There is no unexplained gap left in the arithmetic.

The committee should treat the arrears as **two separate problems**: roughly K3,500 of dead debt from the seven
members who left before their leaving month was recorded, and the rest from members who are still on the register —
eight of whom (K4,000) were deactivated on 2 November 2026 and will need a personal approach before anything else can
be done about them.

Collection is still the bigger problem. The number of members paying fell from 50 in July and August to 29 in
October — a 42% fall in the paying base — and the money collected with it, from K5,000 to K2,900.

---

## 2. Current position

| Measure | Value |
| --- | --- |
| Members on the register | 67 (52 active, 15 departed) |
| Active members | 52 (45 plain members + 7 officers) |
| Member-months due (Jul–Nov 2026) | 334 |
| Expected at K100 per member per month | K33,400 |
| Contributions received | K17,100 (171 contributions) |
| Member-months paid **inside the months each member owed** | 171 |
| Member-months unpaid | 163 |
| **Arrears outstanding** | **K16,300** |
| Received before joining | K0 (was K500 — section 5) |
| Paid ahead of the month it is booked against | K0 (was K500 — section 3) |
| Compliance rate | 51% |

The arrears above are what the platform reports, and they are the arithmetic as well: 163 member-months at K100 each,
and K33,400 expected less K17,100 received. **Both anomalies that made the old report need an explanation have been
cleared**, so for the first time the headline figures reconcile without a footnote.

The cooperative's first money was received on **15 July 2026** and the founding register was signed on **22 July 2026**.
Nothing was collected before that date, so July is the first month in which any contribution could legitimately be
due.

---

## 3. The corrections made on 4 November 2026

Every correction below was made through the platform, by the Chairman, with a written reason recorded in the audit
log. Nothing was edited behind the platform's back and nothing was deleted without a trace.

| # | Action | Member | What was changed |
| --- | --- | --- | --- |
| 1 | Voided (2 Nov) | Mwansa Jacob (106139) | October 2026 K100 CASH row deleted and the money taken back off the buckets. The row had been created by a script on 28 October so the member would pass the good-standing check at sign-in. **No money was ever received for October.** His September payment was left alone. |
| 2 | Voided (2 Nov, reversed the next day) | CHAMA J (104865) | August 2026 K100 row deleted, on the reading that it duplicated his July payment. **That reading was wrong** — see item 3. |
| 3 | Put back (4 Nov) | CHAMA J (104865) | The August 2026 K100 restored **with its original amount, month, receipt number, date received and bucket allocations**, exactly as they were recorded before the void. |
| 4 | Split (4 Nov) | CHAMA J (104865) | September K300 receipt RCT-2026-09-104865 split into **September, October and November 2026 at K100 each**. The paper list annotated it "catch-up for 3 months". July and August are paid separately. |
| 5 | Split (4 Nov) | MWANSA J (106140) | July K200 receipt RCT-2026-07-106140 split into **July and August 2026 at K100 each**. |
| 6 | Split (4 Nov) | MUTAMBO S (106010) | August K200 receipt RCT-2026-08-106010 split into **July and August 2026 at K100 each**. |
| 7 | Split (4 Nov) | KUNDA G (105469) | August K200 receipt RCT-2026-08-105469 split into **August and September 2026 at K100 each**. |

**CHAMA J is now paid up through November**: five months paid, K500 contributed, **K0 arrears**, 100% compliance.

**The three members who paid in lump sums are now shown at three months paid and K200 in arrears**, which is what they
actually owe. The pattern in every case was the same: a member hands over two months' money in one receipt and then
does not pay the following month, because it is already paid for. The platform credits a month only when a
contribution is recorded against that month, so the second month was never credited. It is now.

**No money changed hands and no member was charged twice.** A split keeps the payment booked against its own month
(reduced to that month's share) and creates a sibling row for each other month, with the same method and the same date
received. The original bucket allocations are divided, not recomputed, so the cooperative's kitty is unchanged. The
platform's bucket reconciliation shows **drift of K0 on all six buckets** after all seven corrections, which is the
proof that not one kwacha was lost or duplicated in the process.

### The three controls that now exist

The platform used to have no way to fix a bad row except a script. It now has three, all of which write to the audit
log:

- **Split** — spreads one payment across the months it covers, dividing the money evenly and refusing to land on a
  month the member has already paid.
- **Void** — removes an entry that was never a payment received, reverses the bucket allocations, requires a written
  reason and a confirmation, and records the whole row so it can be put back.
- **Put back** — restores a voided payment **exactly as it was recorded**, reading the row back out of the void entry
  in the audit log.

---

## 4. Collection trend, month by month

| Month | Members paid | Collected | Monthly target | Rate |
| --- | --- | --- | --- | --- |
| July 2026 | 50 of 52 | K5,000 | K5,200 | 96% |
| August 2026 | 50 of 52 | K5,000 | K5,200 | 96% |
| September 2026 | 41 of 52 | K4,100 | K5,200 | 79% |
| October 2026 | 29 of 52 | K2,900 | K5,200 | 56% |
| November 2026 *(to 4th)* | 1 of 52 | K100 | K5,200 | 2% |
| **Total** | **171** | **K17,100** | **K26,000** | **66%** |

*The "of 52" and the K5,200 target are the monthly screen's own figures: it divides each month by the number of
members who are **active today**, not by the number who were active then, and the percentage it shows is the
**number of payments received**, not the cash. The 52 are 45 plain members plus the 7 officers; the dashboard's
"45 active members" is the same number with the officers left out. On 1 November, when 60 members were active, the
same months read 82%, 82%, 67%, 42% and 3% against a K6,000 target. **The money collected in each month does not
change.** It is the K column and the number of members paying that carry the story, and both are the same on either
basis. The total rate is the 171 member-months paid out of the 260 that 52 active members represent over five months;
the 51% in the position table is a stricter measure, because it tests each member against their own liability window.*

171 contributions were recorded and every one of them credits exactly one month a member owed. **The money they carry
is K17,100, and all K17,100 of it settles a month that was owed.** That was not true before 4 November: K500 was being
held on account as received before joining and K500 as paid ahead of the month it was booked against. Both are now K0.

**The trend is downward and it is steep.** Comparing the first two months with the next two:

- Average collected per month fell from **K5,000** (July–August) to **K3,500** (September–October) — a **30% fall**.
- The number of members paying fell from 50 to 29 between July and October — a **42% fall** in the paying base.
- **Only one payment has been received for November**, and it was a September catch-up being credited forward (CHAMA
  J's November share). **November must not be read as a collapse**; the month is four days old and it should be
  judged at the November meeting.

**Why the pattern is not simply "members stopped paying".** The timing of the entries shows the *recording* cycle
slipping as much as the paying cycle:

- July's contributions were received on **15 July**, in cash, each with a sequential receipt number
  (`RCT-2026-07-xxxxx`). This is what a properly collected month looks like.
- October's contributions were entered as a **mobile-money bulk import on 1 November** — that is, the money for
  October did not reach the ledger until the first day of the following month. One member (Mwansa Jacob) paid in cash
  on 28 October with a receipt; that row has now been voided, because no money was received for it.
- If that slippage repeats, November's contributions will land on 1 December, and the cooperative will spend the
  life of this report always one month behind its own ledger.

### What the November figure would look like if the rate recovers

Assuming each contributing member pays the standard K100:

| If November collects | Months paid | Contributed | Arrears | Compliance |
| --- | --- | --- | --- | --- |
| Like October (29 members) | 200 | K20,000 | K13,400 | 60% |
| Like September (41 members) | 212 | K21,200 | K12,200 | 63% |
| Like July (50 members) | 221 | K22,100 | K11,300 | 66% |

Returning to the July rate alone would take **K5,000 of arrears out of the books in a single month**. Nothing in the
ledger says that is beyond the membership — July and August each proved 50 members will pay.

---

## 5. Where the arrears sit

Arrears are not spread evenly. They are concentrated in a small number of members who have paid little or nothing.

| Months paid | Members | Arrears | Share of all arrears |
| --- | --- | --- | --- |
| 0 of their months | 15 | K7,500 | 46% |
| 1 of their months | 1 | K400 | 2% |
| 2 of their months | 11 | K3,200 | 20% |
| 3 of their months | 13 | K2,600 | 16% |
| 4 of their months | 26 | K2,600 | 16% |
| all of their months | 1 | K0 | 0% |
| **Total** | **67** | **K16,300** | **100%** |

*Shares are rounded.*

**The fifteen members who have paid for none of their months carry 46% (K7,500) of all the money owed.** If the
committee wants a single number to work from, it is this one: fifteen names, each owing exactly five months.

### The 15 members who have paid for none of their months

**Eight were deactivated on 2 November 2026**, on the chairman's instruction. Their leaving month is recorded as
November 2026, so the contributions report keeps billing them for July to November — K500 each. Their arrears are
unchanged; what has changed is that they are no longer active members: they cannot sign in, and they are no longer
eligible for soft loans.

| Service # | Name | Rank | Arrears |
| --- | --- | --- | --- |
| 104968 | CHILAMBE I | SGT | K500 |
| 1051301 | CHUNGU I | SGT | K500 |
| 105151 | SIANGA C F | SGT | K500 |
| 105334 | KANGWA N | SGT | K500 |
| 106303 | NENGUKE R | SSGT | K500 |
| 106542 | SAKAUMBA I | SGT | K500 |
| 106592 | SIAMAZOMBA W | CPL | K500 |
| 106645 | SILUPYA R | SGT | K500 |

**Seven more had already departed the cooperative.** Their arrears (K500 each, K3,500 total) should not be chased
and should not be reported as live debt:

| Service # | Name | Status |
| --- | --- | --- |
| 104783 | BANDA J | Left |
| 104812 | BUPE R | Left |
| 105069 | CHISHA A V | Left |
| 105217 | KABENDE S | Left |
| 105328 | KANGWA A | Left |
| 105550 | LUTANGU O | Left |
| 105644 | MATE L | Left |

The K500 each is still being counted because **the month they left has never been recorded** — the platform had no
field for it. That field now exists (recommendation 1). Once the seven leaving months are entered, their liability
stops at the month they left. Each still owes at least the month they joined in, so **at least K700 of the K3,500
stays on the books and at most K2,800 comes off**. Until then, treat the whole K3,500 as a provision rather than as
debt.

### The four lump payments — now settled

This was the one place where the arrears figure was **worse than the truth**. Four members paid more in one receipt
than the month they were booked against, and in every case the extra exactly covered the month they were shown as
missing. All four have now been split and credited forward:

| Service # | Name | Receipts on file | Months credited now | Arrears now |
| --- | --- | --- | --- | --- |
| 104865 | CHAMA J | Jul K100, Aug K100, Sep **K300** | 5 | **K0** |
| 105469 | KUNDA G | Aug **K200**, Oct K100 | 3 | K200 |
| 106010 | MUTAMBO S | Aug **K200**, Sep K100 | 3 | K200 |
| 106140 | MWANSA J | Jul **K200**, Sep K100 | 3 | K200 |

### The joining dates that were wrong

Three members were carried on the payroll list for months before their recorded joining dates, and their balances were
computed against those wrong dates. The chairman confirmed on 2 November 2026 that **all three joined on 22 July
2026**, the day the founding register was signed; the dates on the register were the dates their records were
*created* on the platform (6 August, 6 September and 7 September 2026). The joining dates have been corrected, and the
member form now has a **"Date joined"** field.

| Service # | Name | Joining date now | Months paid | Arrears |
| --- | --- | --- | --- | --- |
| 104916 | Chewe J | 22 July 2026 | 2 of 5 | K300 |
| 105734 | Mphande George | 22 July 2026 | 3 of 5 | K200 |
| 106000 | MUTALE JACK MWABA | 22 July 2026 | 2 of 5 | K300 |

**The arrears did not move because of the correction.** The months that came into each member's liability window are
months they had already paid. What did change is the money itself: the K500 that was being held on account as
"received before joining" is now applied to months the members owed, and that line is **K0**.

---

## 6. What is working

It is worth recording these, because they are the foundation any recovery has to build on.

- **The committee is current through October.** All seven officers have paid every month since they joined through
  October, and each owes only November.

  | Service # | Name | Office | Months paid | Arrears |
  | --- | --- | --- | --- | --- |
  | 106147 | MWANSA M J | Chairman | 4 of 5 | K100 |
  | 105152 | FWOLOSHI T | Vice Chairman | 4 of 5 | K100 |
  | 106759 | RICHARD TEMBO | Chair of Capital Development | 4 of 5 | K100 |
  | 104879 | Chishimba Chanda | Secretary | 4 of 5 | K100 |
  | 106302 | NEEBA GEORGE | Treasurer | 4 of 5 | K100 |
  | 104784 | BANDA L | Treasurer (from 1 November 2026) | 4 of 5 | K100 |
  | 105716 | MKEMBA W | Deputy Treasurer | 4 of 5 | K100 |

  The register therefore carries two Treasurer posts. **104784 BANDA L paid on 1 November for October**, and the
  chairman has confirmed it; the booking was moved to October on 2 November 2026, so he owes only November, like the
  other six officers.

- **27 of the 52 active members (52%) have paid every month since they joined, through October.** These are the
  model's members and the proof that the K100 subscription is affordable. One of them — CHAMA J — has gone further
  and paid through November as well.
- **Some members pay in lumps.** Four members paid above K100 in a month: CHAMA J (K300), and KUNDA G, MUTAMBO S and
  MWANSA J (K200 each). These members are ahead of their schedule rather than behind it, and lump-sum payment is
  evidently an accepted habit in the membership. Section 5 shows how each receipt was credited forward.
- **The ledger and the report reconcile.** 171 contributions, K17,100 received against K33,400 expected. The monthly
  screens and the arrears report agree to the kwacha, and the difference between them is now nil.
- **The buckets reconcile.** All six buckets — LAND, BUSINESS, SOFT_LOANS, ADMIN and the two closed buckets, FUNERAL
  and MEDICAL — show **drift of K0** between their live balance and the running ledger of bucket transactions. The
  active buckets hold K17,118 (LAND K10,270 · BUSINESS K3,420 · SOFT_LOANS K2,572 · ADMIN K856); the two closed
  buckets carry K-15 and K-3 of historical net position, which is why the contributions total is K17,100.

---

## 7. Recommendations

1. **Record the leaving month for the seven departed members** so their arrears can be closed off. All seven have
   paid nothing, so once their leaving months are on file most of the K3,500 comes off — each still owes at least
   the month they joined in, so at least K700 stays on the books and at most K2,800 comes away. In the best case (all
   seven left in July 2026) the arrears fall from K16,300 to **K13,500**. The headline compliance rate moves from 51%
   to 56% — not because anything worsened, but because the seven still count as non-compliant while their liability
   window shrinks.
   *The platform now has the field for this*: a **"Month the member left"** picker on the member record
   (`/members/<id>/edit`). Entering the leaving month stops the contributions report billing that member from the
   month they left, and the member list shows the month against every inactive member. The seven months still need to
   be confirmed by the committee and entered.
2. **Make a personal approach to the eight members who owe for every month they have been on the register** (K4,000
   combined). They were deactivated on 2 November 2026, so they can no longer sign in; the committee should decide
   whether to reinstate any of them if they come back and pay. These are not administrative cases — a phone call each
   will resolve whether they are refusing, unable, or simply unaware.
3. **Bring the recording date forward.** October's money was booked on 1 November. The committee should set a
   standing rule that a month's contributions are recorded by the **15th of the following month**, so that each
   month's ledger is closed before the next meeting.
4. **Capture the mobile-money receipt reference on every imported row.** The July cash entries carry sequential
   receipt numbers; the October import and the November entries show a blank receipt. The receipt number is the link
   between a row in the ledger and a line on the Airtel or MoMo statement, and without it reconciliation has to be
   done by hand. It is also what makes the lump payments above provable.
5. **Note that the welfare buckets are closed and the claims function has been withdrawn.** The GENERAL MEETING of
   12 October 2026 closed the MEDICAL and FUNERAL buckets, and with both funders closed the welfare-claims function
   could not be administered. **The claims option was removed from the platform on 4 November 2026** — members can no
   longer submit a medical or funeral claim, and the committee no longer has a claims queue to work. The claim
   records and the bucket history were left in place so the audit trail stays intact; the table was empty, so nothing
   was lost. The K-15 and K-3 sitting in the two closed buckets are historical net positions and are not recoverable
   cash.
6. **Put the arrears report on the monthly meeting agenda**, with a named follow-up against the largest balances.
   The **15 members owing K500 each account for K7,500 of the K16,300 — 46% of the money owed in a quarter of the
   names.** That is a short enough list to work through in one sitting.
7. **Decide whether to bring the 15 members who paid nothing back onto the register.** They have not paid for a
   single month, and the platform has now recorded that fact plainly rather than letting a script row hide it. The
   committee's decision is between a personal collection and a write-off for the eight who were deactivated.

---

## 8. Notes on the figures

Four points so that the committee is not caught out by arithmetic that looks wrong but is not.

- **The monthly screen's target is a target, not a liability.** The screen divides the number of payments received in
  the month by the number of **currently active** members — 52 now (45 members plus 7 officers), 60 on 1 November —
  and shows a separate cash target of active members × K100, which was K6,000 then and is **K5,200 now**. It applies
  that same denominator to every month, ignoring the fact that members joined in August and September and that fifteen
  who have since left were still on the register earlier in the year. Every month's percentage therefore moves when
  the register changes, without a single kwacha changing hands. Use the monthly screen for *cash in* and the arrears
  report for *what is owed*.
- **The two "of 52" and "of 45" figures are both right.** The contributions screen counts every active user, which
  includes the seven officers; the dashboard counts only members whose role is MEMBER. For November both read the
  same way: CHAMA J's payment is the one payment received, and he is one of the 45 members.
- **K33,400 expected less K17,100 received is K16,300, and that is exactly the arrears.** There is no reconciling
  item any more. Before 4 November the difference was K500, split between money received before joining and money
  paid ahead of the month it was booked against; both are now K0.
- **The K26,000 in the trend table and the K33,400 in the position table are both correct**, and the K7,400
  difference is fully explained: the fifteen members who have left were still on the register during the earlier
  months and are still billed for July to November (75 member-months), less K100 for Mwansa Jacob, who joined in
  August and was not liable for all five months.

---

## 9. Source data

- Contributions report read from the live platform on 4 November 2026: 67 members, 171 of 334 member-months paid,
  K17,100 contributed, K33,400 expected, K16,300 arrears, 51% compliance.
- Monthly contribution screens for July, August, September, October and November 2026, all read from the live platform
  on 4 November 2026.
- The platform's audit log, read on 4 November 2026: two `CONTRIBUTION_VOIDED` entries, one
  `CONTRIBUTION_RESTORED` entry, four `CONTRIBUTION_SPLIT` entries and four `CONTRIBUTION_MOVED` entries from
  2 November, each with the reason written at the time.
- The dashboard's bucket reconciliation, read on 4 November 2026: all six buckets balanced, drift K0.
- The chairman's confirmation of 2 November 2026 that 104784 BANDA L, 105257 KAKOMA R, 105046 CHIRWA J and 105065
  CHISENGA ABEL paid on 1 and 2 November **for October**.
- The chairman's confirmation of 4 November 2026 that CHAMA J paid K100 in July, K100 in August and K300 in September,
  with the September receipt annotated "catch-up for 3 months" on the paper list, and that 106010 MUTAMBO S,
  106140 MWANSA J and 105469 KUNDA G each paid K200 in a single receipt covering two months.

*Prepared from the live ledger on 1 November 2026 and re-verified against the live platform on 2 November 2026 and again
on 4 November 2026, after the seven ledger corrections. Figures are as at the date of preparation and will move as
November contributions are recorded.*
