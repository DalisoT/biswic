/**
 * Seed the 5 starter financial-literacy modules + their quizzes.
 *
 * Idempotent: uses upserts keyed on slug so re-running is safe.
 *
 * Run with: pnpm tsx prisma/seed-learning.ts
 */

import { PrismaClient, Role, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Option = { text: string; isCorrect: boolean; order: number };
type Question = {
  order: number;
  prompt: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';
  explanation?: string;
  options: Option[];
};

type Lesson = {
  order: number;
  title: string;
  content: string;
  estimatedMin: number;
};

type Module = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  audience: Role[];
  order: number;
  lessons: Lesson[];
  quiz: {
    title: string;
    passingScore: number;
    questions: Question[];
  };
};

const MODULES: Module[] = [
  {
    slug: 'why-we-save-together',
    title: 'Why We Save Together',
    summary:
      'Cooperative saving is the foundation of BISWIC. Learn why pooling small monthly contributions creates security that no individual member could achieve alone.',
    content: `# Why We Save Together

The Brothers in Service Welfare, Land & Investment Cooperative exists because individual saving is fragile. A single K100 saved alone does nothing. A thousand K100 saved together builds land, pays welfare claims, and funds businesses.

## Three core ideas

1. **Solidarity over self-interest.** When Chama J falls sick, the FUNERAL bucket pays K1,500. When Banda L wants a soft loan, the SOFT_LOANS bucket has cash. You didn't pay into HIS bucket — you paid into YOURS, and yours paid for him. Next month, it might be yours.

2. **Regular beats large.** K100 every month for 12 months = K1,200. A "someday I'll save K1,200 lump sum" rarely happens. The monthly discipline is what makes the cooperative real.

3. **Transparency.** Every kwacha is tracked in this app. Bucket balances, contributions, claims, loans — all of it is in the database. Run any month, the math holds.

## What this means in practice

- **Show up monthly.** Even K100 builds the system.
- **Trust the buckets.** The allocation is locked by the Constitution; no officer can re-route funds.
- **Speak up at AGM.** The Constitution is yours to amend.

Welcome to the cooperative.`,
    audience: [Role.MEMBER, Role.CHAIRPERSON, Role.VICE_CHAIRPERSON, Role.FW, Role.SECRETARY, Role.TREASURER, Role.DEPUTY_TREASURER, Role.CCD],
    order: 1,
    lessons: [
      {
        order: 1,
        title: 'What is a cooperative?',
        content: `# What is a cooperative?

A cooperative is a group of people who pool resources to do together what they cannot do alone. The three defining traits:

- **One member, one vote** (not one share, one vote)
- **Members share the surplus** (any profit returns to members, not external shareholders)
- **Voluntary and open** (anyone eligible can join; no one is forced to stay)

BISWIC is a welfare + land + business cooperative. Our surplus goes to:
- Welfare claims (funerals, medical)
- Land purchases
- Business seed funding
- Member soft loans

A cooperative is the opposite of a bank: the members ARE the institution.`,
        estimatedMin: 3,
      },
      {
        order: 2,
        title: 'Why K100 matters more than it looks',
        content: `# Why K100 matters more than it looks

K100 feels small. But BISWIC has 60+ active members, so K100 × 60 = K6,000 per month. That is K72,000 per year — and that's BEFORE the larger catch-up payments and the LAND bucket's surplus.

Most importantly: **regular** saving means the bucket is **always funded**. A cooperative that only collects K50,000 once a year can't pay a K1,500 funeral claim in February. A cooperative that collects K6,000 every month is always ready.

Discipline beats scale.`,
        estimatedMin: 3,
      },
      {
        order: 3,
        title: 'Your three duties as a member',
        content: `# Your three duties as a member

1. **Pay monthly.** K100 default. Bigger if you want to catch up. Don't let it lapse.
2. **Vote at AGM.** The Constitution is a living document. If you don't show up, others decide for you.
3. **Hold the institution accountable.** Bucket balances are public. Ask the Treasurer for the latest numbers. If something looks off, raise it at AGM.`,
        estimatedMin: 3,
      },
    ],
    quiz: {
      title: 'Why We Save Together — Quiz',
      passingScore: 70,
      questions: [
        {
          order: 1,
          prompt: 'How many votes does each member get at the AGM?',
          type: 'MULTIPLE_CHOICE',
          explanation: 'Cooperatives follow one-member-one-vote, not one-share-one-vote. This protects small contributors from being outvoted by large ones.',
          options: [
            { text: 'One vote per K100 contributed', isCorrect: false, order: 1 },
            { text: 'One vote per member', isCorrect: true, order: 2 },
            { text: 'One vote per officer only', isCorrect: false, order: 3 },
            { text: 'Votes proportional to seniority', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 2,
          prompt: 'Where does the cooperative\'s surplus go?',
          type: 'MULTI_SELECT',
          explanation: 'All four are legitimate uses of surplus, decided by the membership at AGM. The Constitution sets the buckets but the members decide priorities.',
          options: [
            { text: 'Welfare claims (funerals, medical)', isCorrect: true, order: 1 },
            { text: 'Land purchases', isCorrect: true, order: 2 },
            { text: 'Member soft loans', isCorrect: true, order: 3 },
            { text: 'External shareholders', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 3,
          prompt: 'A cooperative that only collects K50,000 once a year cannot easily pay a K1,500 funeral claim in February.',
          type: 'TRUE_FALSE',
          explanation: 'This is the core argument for monthly discipline: the bucket must be funded continuously, not in lumps.',
          options: [
            { text: 'True', isCorrect: true, order: 1 },
            { text: 'False', isCorrect: false, order: 2 },
          ],
        },
        {
          order: 4,
          prompt: 'Which of these is NOT a duty of a BISWIC member?',
          type: 'MULTIPLE_CHOICE',
          explanation: 'Members don\'t approve individual welfare claims — that\'s the Welfare Officer + FW + Chair. Members vote on the Constitution and major decisions at AGM.',
          options: [
            { text: 'Pay monthly contributions', isCorrect: false, order: 1 },
            { text: 'Vote at AGM', isCorrect: false, order: 2 },
            { text: 'Approve individual welfare claims personally', isCorrect: true, order: 3 },
            { text: 'Hold officers accountable', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 5,
          prompt: 'If 60 members each contribute K100, how much is collected per month?',
          type: 'MULTIPLE_CHOICE',
          explanation: '60 × K100 = K6,000 per month, K72,000 per year — before catch-up payments.',
          options: [
            { text: 'K600', isCorrect: false, order: 1 },
            { text: 'K1,200', isCorrect: false, order: 2 },
            { text: 'K6,000', isCorrect: true, order: 3 },
            { text: 'K60,000', isCorrect: false, order: 4 },
          ],
        },
      ],
    },
  },

  {
    slug: 'reading-your-statement',
    title: 'Reading Your Statement',
    summary:
      'Your /statement page tells the full story of your year — contributions paid, claims received, loans taken, bucket balance. Learn to read it in 5 minutes.',
    content: `# Reading Your Statement

Your personal statement is the canonical record of your year with the cooperative. Every K100 contribution, every claim, every loan — all in one place.

## What you'll see

The statement page has four sections:

1. **Contributions** — every monthly payment you made, with date and receipt number
2. **Welfare claims** — every claim you submitted and its status (approved/denied/paid)
3. **Soft loans** — your active and completed loans, with balance and repayment schedule
4. **Bucket impact** — your share of each bucket (informational, notional only)

## How to read it

- **Green rows = money in** (contributions)
- **Red rows = money out** (loans disbursed, claims paid)
- **Yellow rows = pending** (claim in review, loan approved but not yet disbursed)

If anything looks wrong, contact the Treasurer immediately. Don't wait for AGM.`,
    audience: [Role.MEMBER, Role.TREASURER, Role.DEPUTY_TREASURER, Role.FW, Role.SECRETARY],
    order: 2,
    lessons: [
      {
        order: 1,
        title: 'The four sections of your statement',
        content: `# The four sections

1. **Contributions** — every K100 (or K200 catch-up) you paid, month by month
2. **Welfare claims** — every claim you submitted for funeral or medical support
3. **Soft loans** — your loan history with the cooperative
4. **Bucket impact** — your notional share of the FUNERAL, MEDICAL, LAND, etc. buckets

If a section is empty, you haven't used that part of the cooperative yet — that's fine.`,
        estimatedMin: 3,
      },
      {
        order: 2,
        title: 'Reading the colours',
        content: `# Reading the colours

- **Green** = money you paid in
- **Red** = money paid out for you (claim, loan disbursed)
- **Yellow** = pending (in review, awaiting approval)
- **Grey** = historical, no action needed

Most members see mostly green. If you see red, that's a claim that was approved and paid, or a loan that was disbursed.`,
        estimatedMin: 2,
      },
    ],
    quiz: {
      title: 'Reading Your Statement — Quiz',
      passingScore: 70,
      questions: [
        {
          order: 1,
          prompt: 'What does a green row in your statement mean?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: 'Money you paid in', isCorrect: true, order: 1 },
            { text: 'Money paid out for you', isCorrect: false, order: 2 },
            { text: 'Pending approval', isCorrect: false, order: 3 },
            { text: 'A loan default', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 2,
          prompt: 'Your statement shows your notional share of the bucket balance.',
          type: 'TRUE_FALSE',
          explanation: 'The "bucket impact" section is informational — it shows what your share of each bucket would be if it were distributed. It is NOT a withdrawal entitlement.',
          options: [
            { text: 'True', isCorrect: true, order: 1 },
            { text: 'False', isCorrect: false, order: 2 },
          ],
        },
        {
          order: 3,
          prompt: 'Which of these sections might be empty for a brand-new member?',
          type: 'MULTI_SELECT',
          options: [
            { text: 'Contributions', isCorrect: false, order: 1 },
            { text: 'Welfare claims', isCorrect: true, order: 2 },
            { text: 'Soft loans', isCorrect: true, order: 3 },
            { text: 'Bucket impact', isCorrect: false, order: 4 },
          ],
        },
      ],
    },
  },

  {
    slug: 'soft-loans-101',
    title: 'Soft Loans 101',
    summary:
      'How BISWIC soft loans work: who can apply, interest rate, repayment schedule, and what happens if you miss a payment.',
    content: `# Soft Loans 101

The SOFT_LOANS bucket funds short-term, low-interest loans to members in good standing. This module explains the rules so you can borrow confidently.

## Eligibility (Constitution Art. 5.5)

To apply for a soft loan, you must:
- Be an active member for at least 6 months
- Have no outstanding loan
- Have no prior default
- Have no contributions in arrears
- Declare any conflict of interest with the Lending Sub-Committee

## Loan terms

- **Maximum principal:** K3,000
- **Term:** 1 to 6 months
- **Interest:** 5% per annum (calculated on the outstanding balance)
- **Approval:** requires 2 of 3 Lending Sub-Committee votes

## Repayment

Repayment is by salary deduction (preferred) or cash. The schedule is generated when the loan is disbursed. Each payment has:
- A due date
- A principal portion
- An interest portion

## What if you miss a payment?

Two missed payments = the loan is flagged as **defaulted**. Consequences:
- Listed as a defaulter on the dashboard
- The outstanding balance is converted to a "written-off" status (per Constitution Art. 5.5(f))
- You become ineligible for new soft loans until the default is cleared
- AGM can vote to forgive the default in exceptional cases

Borrow within your means. The soft loan is for emergencies, not lifestyle.`,
    audience: [Role.MEMBER, Role.FW, Role.TREASURER, Role.CHAIRPERSON],
    order: 3,
    lessons: [
      {
        order: 1,
        title: 'Eligibility: who can apply',
        content: `# Eligibility

You can apply for a soft loan if you:
- Have been an active member for **6+ months**
- Have **no outstanding loan**
- Have **never defaulted** on a previous loan
- Have **no contributions in arrears** (current month paid)
- Declare any **conflict of interest** with the Lending Sub-Committee

If you fail any of these, the system will reject the application. Talk to the FW if you think this is in error.`,
        estimatedMin: 3,
      },
      {
        order: 2,
        title: 'Loan terms: how much, how long, at what cost',
        content: `# Loan terms

- **Maximum:** K3,000 principal
- **Term:** 1 to 6 months
- **Interest:** 5% per annum (simple, on outstanding balance)
- **Approval:** 2 of 3 Lending Sub-Committee members must sign off

Example: K1,000 over 3 months at 5% p.a. = K1,000 principal + K12.50 interest = K1,012.50 total. Pay K337.50 per month.`,
        estimatedMin: 4,
      },
      {
        order: 3,
        title: 'What happens if you default',
        content: `# What happens if you default

**Two missed payments = defaulted** (Constitution Art. 5.5(f)).

Consequences:
- You appear on the "Defaulters" list visible to all officers
- The loan balance is marked "written off"
- You cannot apply for a new loan until the default is cleared
- Your AGM can vote to forgive the default in compassionate cases

**Important:** the default stays on your record permanently. It does NOT reset when you pay off the loan. Defaulting is a serious mark on your membership.

If you anticipate missing a payment, contact the FW BEFORE the due date. We can often adjust the schedule. We cannot help if you go silent.`,
        estimatedMin: 4,
      },
    ],
    quiz: {
      title: 'Soft Loans 101 — Quiz',
      passingScore: 75,
      questions: [
        {
          order: 1,
          prompt: 'What is the maximum principal for a BISWIC soft loan?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: 'K1,000', isCorrect: false, order: 1 },
            { text: 'K3,000', isCorrect: true, order: 2 },
            { text: 'K5,000', isCorrect: false, order: 3 },
            { text: 'K10,000', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 2,
          prompt: 'How many missed payments trigger a default?',
          type: 'MULTIPLE_CHOICE',
          explanation: 'Per Constitution Art. 5.5(f): two missed payments = defaulted.',
          options: [
            { text: 'One', isCorrect: false, order: 1 },
            { text: 'Two', isCorrect: true, order: 2 },
            { text: 'Three', isCorrect: false, order: 3 },
            { text: 'It varies by loan amount', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 3,
          prompt: 'You must be an active member for at least how long before you can apply for a soft loan?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: '1 month', isCorrect: false, order: 1 },
            { text: '3 months', isCorrect: false, order: 2 },
            { text: '6 months', isCorrect: true, order: 3 },
            { text: '12 months', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 4,
          prompt: 'Once a default is recorded, it stays on your record permanently even if you pay off the loan.',
          type: 'TRUE_FALSE',
          explanation: 'The default remains a mark on your membership record. It can only be cleared by an AGM vote, not by repayment.',
          options: [
            { text: 'True', isCorrect: true, order: 1 },
            { text: 'False', isCorrect: false, order: 2 },
          ],
        },
        {
          order: 5,
          prompt: 'How many Lending Sub-Committee approvals are required for a loan?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: '1 of 3', isCorrect: false, order: 1 },
            { text: '2 of 3', isCorrect: true, order: 2 },
            { text: '3 of 3 (unanimous)', isCorrect: false, order: 3 },
            { text: 'Only the Chair', isCorrect: false, order: 4 },
          ],
        },
      ],
    },
  },

  {
    slug: 'welfare-claims',
    title: 'Welfare Claims — What\'s Eligible',
    summary:
      'BISWIC pays welfare claims for funeral and medical emergencies. Learn the eligibility, caps, and the three-signature approval flow.',
    content: `# Welfare Claims — What's Eligible

The FUNERAL and MEDICAL buckets exist to support members in crisis. This module covers what is and isn't eligible.

## Funeral claims

Covered:
- Death of the member themselves
- Death of spouse, child, parent, or financially-dependent sibling
- Documented by a death certificate (or police/clinical report if unavailable)

Cap: **K1,500 per event**. Limit: **one event per family per year**.

## Medical claims

Covered:
- Hospitalization of the member
- Surgery for the member, spouse, or child
- Emergency medical evacuation
- Documented by hospital invoice

Cap: **K2,000 per event**. Limit: **one event per member per year**.

## What's NOT eligible

- Cosmetic surgery
- Routine dental work
- Pre-existing conditions where the member didn't disclose
- Anything not supported by a proper invoice or certificate

## Approval flow (Constitution Art. 5.3)

Three signatures required:
1. **Welfare Officer** (where one is appointed)
2. **Finance Warrant (FW)**
3. **Chairperson**

If the Welfare Officer position is vacant, only the FW + Chair signatures are needed.`,
    audience: [Role.MEMBER, Role.WELFARE_OFFICER, Role.FW, Role.CHAIRPERSON],
    order: 4,
    lessons: [
      {
        order: 1,
        title: 'Funeral claims — eligibility and cap',
        content: `# Funeral claims

**Who:** death of the member, spouse, child, parent, or financially-dependent sibling
**Cap:** K1,500 per event
**Limit:** one event per family per year
**Document required:** death certificate (or police/clinical report if unavailable)

If the family has already used their annual funeral claim, the Welfare Officer + FW can still approve a second event if the bucket has sufficient funds — but only by AGM vote for a special allocation.`,
        estimatedMin: 3,
      },
      {
        order: 2,
        title: 'Medical claims — eligibility and cap',
        content: `# Medical claims

**Who:** hospitalization of the member, surgery for member/spouse/child, emergency evacuation
**Cap:** K2,000 per event
**Limit:** one event per member per year
**Document required:** hospital invoice

What is NOT covered:
- Cosmetic surgery
- Routine dental
- Pre-existing conditions undisclosed at membership

For surgery over K2,000, the Welfare Officer can submit a special application to AGM for an exemption.`,
        estimatedMin: 3,
      },
      {
        order: 3,
        title: 'The three-signature approval flow',
        content: `# Three signatures

Every welfare claim needs three signatures (or two if the Welfare Officer is vacant):

1. **Welfare Officer** — verifies the event is genuine and eligible
2. **Finance Warrant (FW)** — verifies the bucket has funds and the member is in good standing
3. **Chairperson** — final sign-off

Once all three are in, the payment is made from the appropriate bucket (FUNERAL or MEDICAL) and the claim is marked as PAID in the system.`,
        estimatedMin: 3,
      },
    ],
    quiz: {
      title: 'Welfare Claims — Quiz',
      passingScore: 70,
      questions: [
        {
          order: 1,
          prompt: 'What is the cap for a funeral claim?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: 'K500', isCorrect: false, order: 1 },
            { text: 'K1,500', isCorrect: true, order: 2 },
            { text: 'K2,000', isCorrect: false, order: 3 },
            { text: 'K3,000', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 2,
          prompt: 'What is the cap for a medical claim?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: 'K1,000', isCorrect: false, order: 1 },
            { text: 'K1,500', isCorrect: false, order: 2 },
            { text: 'K2,000', isCorrect: true, order: 3 },
            { text: 'K5,000', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 3,
          prompt: 'Which of these are NOT eligible for a welfare claim?',
          type: 'MULTI_SELECT',
          options: [
            { text: 'Cosmetic surgery', isCorrect: true, order: 1 },
            { text: 'Routine dental work', isCorrect: true, order: 2 },
            { text: 'Emergency surgery', isCorrect: false, order: 3 },
            { text: 'Pre-existing conditions undisclosed at membership', isCorrect: true, order: 4 },
          ],
        },
        {
          order: 4,
          prompt: 'How many signatures are needed for a welfare claim if the Welfare Officer position is vacant?',
          type: 'MULTIPLE_CHOICE',
          explanation: 'Without a Welfare Officer, only FW + Chair signatures are required (Constitution Art. 5.3 fallback).',
          options: [
            { text: 'Three', isCorrect: false, order: 1 },
            { text: 'Two (FW + Chair)', isCorrect: true, order: 2 },
            { text: 'Just one (Chair)', isCorrect: false, order: 3 },
            { text: 'None, AGM votes', isCorrect: false, order: 4 },
          ],
        },
      ],
    },
  },

  {
    slug: 'preparing-for-agm',
    title: 'Preparing for AGM',
    summary:
      'The Annual General Meeting is where members vote on the Constitution, approve the budget, and elect officers. Make your voice count.',
    content: `# Preparing for AGM

The Annual General Meeting (AGM) is the supreme decision-making body of BISWIC. Every active member has a voice — and a vote.

## When and where

AGM is held annually, typically in the second quarter. The Secretary issues formal notice at least 14 days in advance, including:
- Date, time, venue
- Agenda
- Motions to be voted on
- Nominations for officer positions

## Quorum

A quorum is 50% + 1 of active members. If quorum is not met, the meeting is adjourned for 14 days, and the reconvened meeting can proceed with whatever members are present.

## What you vote on

- Adoption of the previous AGM minutes
- Treasurer's report (bucket balances, expenses, etc.)
- Motions to amend the Constitution
- Election of officers (Chair, Vice Chair, Secretary, Treasurer, etc.)
- Approval of the annual budget
- Any other business properly raised

## How to participate

1. **Read the agenda in advance.** The Secretary distributes the agenda and supporting documents at least 7 days before the meeting.
2. **Submit motions in writing.** Any member can submit a motion. Submit it to the Secretary at least 7 days in advance.
3. **Speak up during open discussion.** Motions are debated before the vote. Be brief, be clear, be respectful.
4. **Vote.** One member, one vote. The Chair breaks ties.

## Common AGM mistakes to avoid

- Not showing up (you lose your chance to influence the year ahead)
- Voting without reading the documents
- Treating it as a social event (it's a working meeting)
- Bringing up business that should have been raised in writing in advance

AGM is your right. Use it.`,
    audience: [Role.MEMBER, Role.CHAIRPERSON, Role.VICE_CHAIRPERSON, Role.SECRETARY, Role.TREASURER, Role.DEPUTY_TREASURER, Role.CCD, Role.FW, Role.WELFARE_OFFICER],
    order: 5,
    lessons: [
      {
        order: 1,
        title: 'What is a quorum?',
        content: `# Quorum

A quorum is the minimum number of members who must be present for AGM business to be valid. For BISWIC, that is 50% + 1 of active members.

If quorum is not met at the start of the meeting, the meeting is **adjourned** (delayed) for 14 days. The reconvened meeting can proceed with whatever members are present, regardless of quorum.

**Implication:** if you don't show up, you risk a meeting that has no legitimacy. Show up.`,
        estimatedMin: 3,
      },
      {
        order: 2,
        title: 'Submitting a motion',
        content: `# Submitting a motion

Any active member can submit a motion. A motion is a formal proposal for the AGM to vote on.

To submit a motion:
1. Write it down in plain language
2. Include your name, service number, and signature
3. Deliver to the Secretary at least **7 days** before AGM

Examples of valid motions:
- "Increase the MEDICAL bucket from 3% to 5%"
- "Approve K2,000 for the AGMs catering"
- "Amend Constitution Art. 5.5 to allow loans up to K5,000"

Examples of INVALID motions:
- "I think we should do something" (too vague)
- "Fire the Chair" (must specify what for)
- Anything personal (not a cooperative matter)`,
        estimatedMin: 4,
      },
      {
        order: 3,
        title: 'Voting and decision-making',
        content: `# Voting

- **One member, one vote** (regardless of contributions)
- **Show of hands** for routine matters
- **Secret ballot** for officer elections
- **2/3 majority** for constitutional amendments
- **Simple majority** for ordinary motions
- The **Chair breaks ties** on any matter

If you disagree with a decision, your options are:
1. Move to amend (during the same meeting, if the motion is still open)
2. Table the motion (defer to the next meeting)
3. Vote against (record your dissent in the minutes)
4. Resign from the cooperative (last resort)`,
        estimatedMin: 4,
      },
    ],
    quiz: {
      title: 'Preparing for AGM — Quiz',
      passingScore: 70,
      questions: [
        {
          order: 1,
          prompt: 'What is the quorum for a BISWIC AGM?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: '25% of members', isCorrect: false, order: 1 },
            { text: '50% + 1 of members', isCorrect: true, order: 2 },
            { text: 'All members', isCorrect: false, order: 3 },
            { text: 'Just the officers', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 2,
          prompt: 'A motion must be submitted to the Secretary at least how many days before AGM?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: '24 hours', isCorrect: false, order: 1 },
            { text: '3 days', isCorrect: false, order: 2 },
            { text: '7 days', isCorrect: true, order: 3 },
            { text: '30 days', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 3,
          prompt: 'Constitutional amendments require what kind of majority?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { text: 'Simple majority', isCorrect: false, order: 1 },
            { text: '2/3 majority', isCorrect: true, order: 2 },
            { text: 'Unanimous', isCorrect: false, order: 3 },
            { text: 'Just the Chair\'s approval', isCorrect: false, order: 4 },
          ],
        },
        {
          order: 4,
          prompt: 'If quorum is not met, the meeting can still proceed if 14 days pass and members reconvene.',
          type: 'TRUE_FALSE',
          options: [
            { text: 'True', isCorrect: true, order: 1 },
            { text: 'False', isCorrect: false, order: 2 },
          ],
        },
      ],
    },
  },
];

async function main() {
  console.log(`Seeding ${MODULES.length} literacy modules + quizzes...`);

  for (const mod of MODULES) {
    const moduleRow = await prisma.learningModule.upsert({
      where: { slug: mod.slug },
      create: {
        slug: mod.slug,
        title: mod.title,
        summary: mod.summary,
        content: mod.content,
        audience: mod.audience,
        isPublished: true,
        order: mod.order,
      },
      update: {
        title: mod.title,
        summary: mod.summary,
        content: mod.content,
        audience: mod.audience,
        isPublished: true,
        order: mod.order,
      },
    });
    console.log(`  ✓ Module: ${mod.slug}`);

    // Replace lessons (idempotent: delete + recreate)
    await prisma.learningLesson.deleteMany({ where: { moduleId: moduleRow.id } });
    for (const lesson of mod.lessons) {
      await prisma.learningLesson.create({
        data: {
          moduleId: moduleRow.id,
          order: lesson.order,
          title: lesson.title,
          content: lesson.content,
          estimatedMin: lesson.estimatedMin,
        },
      });
    }
    console.log(`    ${mod.lessons.length} lessons`);

    // Replace quiz (delete cascade also drops questions/options/attempts/answers)
    await prisma.quiz.deleteMany({ where: { moduleId: moduleRow.id } });
    const quizRow = await prisma.quiz.create({
      data: {
        moduleId: moduleRow.id,
        title: mod.quiz.title,
        passingScore: mod.quiz.passingScore,
      },
    });
    for (const q of mod.quiz.questions) {
      const questionRow = await prisma.quizQuestion.create({
        data: {
          quizId: quizRow.id,
          order: q.order,
          prompt: q.prompt,
          type: q.type,
          explanation: q.explanation ?? null,
        },
      });
      for (const o of q.options) {
        await prisma.quizOption.create({
          data: {
            questionId: questionRow.id,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order,
          },
        });
      }
    }
    console.log(`    Quiz: ${mod.quiz.questions.length} questions`);
  }

  console.log('\nLiteracy seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
