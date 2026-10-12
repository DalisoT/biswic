-- Migration: 20261012140000_zambia_literacy_seed
-- Seeds 10 Zambia-specific financial literacy modules + quizzes.
-- Generated from prisma/seed-learning-zambia.ts via ts_to_json.py + json_to_sql.py.
-- Idempotent: safe to re-run; modules upsert on slug, lessons + quiz
-- are wiped and recreated each run (CASCADE drops questions/options).
--
-- Topics covered:
--   1. Mastering Your Civil Servant Salary (PAYE, NAPSA, allowances)
--   2. The Debt Trap: Mobile Money Loans, Sakawa & Pyramid Schemes
--   3. Building Your 3-Month Emergency Fund
--   4. NAPSA & Retirement: How to Maximize Your Benefits
--   5. Banking in Zambia: Hidden Costs & Smart Choices
--   6. Insurance & Risk Protection for Civil Servants
--   7. Why Your Cooperative is Your Best Investment
--   8. Avoiding Scams: Sakawa, Kachalo & Pyramid Schemes in Zambia
--   9. Property & Land: Building Wealth You Can Pass Down
--  10. Teaching Your Family About Money: Generational Wealth
--
-- Uses pure-SQL chained CTEs (no DO block, no PL/pgSQL) for maximum portability
-- across psql, Supabase SQL editor, and other clients.

BEGIN;

-- ----- mastering-civil-servant-salary -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('mastering-civil-servant-salary', 'Mastering Your Civil Servant Salary', 'Understand every line of your payslip: basic pay, allowances, NAPSA, PAYE, and the "take-home" trap that catches most civil servants.',
       'Understand every line of your payslip: basic pay, allowances, NAPSA, PAYE, and the "take-home" trap that catches most civil servants.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 6, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'Anatomy of a Zambian civil servant payslip', '# Anatomy of a Zambian civil servant payslip

Most civil servants look at their payslip and only see the **net pay** at the bottom. That''s a mistake. To make smart financial decisions, you need to understand every line.

## The standard components

| Line | What it is | Typical % of gross |
| --- | --- | --- |
| Basic Pay | The fixed salary for your grade and notch | 100% |
| Housing Allowance | Taxable, supposed to cover rent | ~30% of basic |
| Transport Allowance | Taxable, supposed to cover commute | ~15% of basic |
| Rural Hardship Allowance | If posted to rural area | Variable |
| Shift / On-Call Allowance | If your job requires it | Variable |
| **Gross Pay** | Sum of all earnings | — |
| NAPSA (5%) | Pension contribution | -5% of basic |
| PAYE | Pay-As-You-Earn income tax | -0% to -37.5% (sliding scale) |
| Union dues / loans | If applicable | Variable |
| **Net Pay** | What hits your account | 60-80% of gross |

## The three deductions that matter

### 1. NAPSA (5% of basic pay)
- Goes into your retirement savings
- Matched 5% by your employer (so 10% total per month)
- Stays in NAPSA until retirement (or 55, whichever is later)
- **Important**: NAPSA is NOT your emergency fund. Don''t think of it as accessible money.

### 2. PAYE (Pay-As-You-Earn)
- This is the tax band system: 0%, 20%, 30%, 37.5% as your income rises
- The first K5,100/month is tax-free (2024 thresholds; check current)
- Tax is **progressive** — you pay 0% on the first K5,100, 20% on the next slice, etc.
- The Tax Calculator: take your monthly gross above K5,100, multiply by 0.20 for the next K2,000, then 0.30, then 0.375

### 3. Union dues / loan repayments
- If you''re in a union, monthly dues are deducted
- If you have a salary-deducted loan (e.g. for a car), it''s taken before you see the money
- **Avoid** over-committing your salary to these — see the next module

## The "take-home" trap

A common scenario: A civil servant on grade 7/3 earns K8,000 gross. After PAYE, NAPSA, and union dues, they take home K6,200. They budget as if they earn K8,000 — and end up broke by the 20th of every month.

**Rule: budget on your net pay, not your gross pay.** What hits your account is what you can spend.

## Three habits for civil servants

1. **Read your payslip every month.** Look for errors. PAYE miscalculations are common.
2. **Track your net pay in a simple spreadsheet or notebook.** Income in, expenses out. After 2-3 months you''ll see exactly where the money goes.
3. **Treat your net pay as your real income.** Adjust your lifestyle to fit it, not to the gross figure.

> "Take-home pay is your real pay. Budget for what you actually receive, not what your salary letter claims."', 6),
      ((SELECT id FROM m), 2, 'PAYE tax bands explained (with examples)', '# PAYE tax bands explained

PAYE (Pay-As-You-Earn) is the income tax Zambia deducts from your salary each month. The bands are **progressive** — you pay 0% on the first portion, then 20% on the next, and so on.

## Current tax bands (monthly, indicative)

| Band | Income range | Rate |
| --- | --- | --- |
| 1 | K0 – K5,100 | 0% |
| 2 | K5,101 – K7,100 | 20% |
| 3 | K7,101 – K9,200 | 30% |
| 4 | Above K9,200 | 37.5% |

> Check the latest ZRA (Zambia Revenue Authority) thresholds — they change with each budget.

## Worked example 1: K6,500/month gross

- First K5,100: 0% = K0 tax
- Next K1,400: 20% = K280 tax
- **Total PAYE: K280**
- After PAYE only: K6,220
- After NAPSA (5% of basic, say K5,000): -K250
- **Net pay: K5,970**

## Worked example 2: K10,000/month gross

- First K5,100: 0%
- Next K2,000: 20% = K400
- Next K2,100: 30% = K630
- Above K800: 37.5% = K300
- **Total PAYE: K1,330**
- After NAPSA: -K500
- **Net pay: K8,170**

## The marginal rate trap

Many civil servants get confused: "I earn K10,000, why is my PAYE not 37.5% × K10,000 = K3,750?"

Because PAYE is **marginal**. Only the amount *above* K9,200 is taxed at 37.5%. Your effective rate is much lower.

## When you get a raise

If you get a K500 raise that pushes you from K9,200 to K9,700, the extra K500 is taxed at 37.5% = K187.50. You take home K312.50.

**Lesson**: K500 gross raise is not K500 net. Always calculate the marginal tax.

## The "bracket planning" trick

If you have flexibility on overtime, bonuses, or side income, try to keep your monthly gross **just below** a band threshold. For example, instead of working overtime to push you to K9,300, stop at K9,000. That saves you K93.75 in tax.

(Don''t cheat on your taxes — but do plan around them legally.)

## Common PAYE mistakes to watch for

- **Under-withholding**: If your employer miscalculates, you owe ZRA at year-end. Set aside 5% of every extra payment just in case.
- **Over-withholding**: If they take too much, you get a refund. File your return.
- **Tax-free allowances**: Some allowances (uniform, protective gear) are tax-free. Your HR can tell you which.

> "PAYE is progressive for a reason. Don''t fear higher income — but do know the band you''re in."', 7),
      ((SELECT id FROM m), 3, 'The salary trap and how to escape it', '# The salary trap (and how to escape it)

The salary trap is the cycle that catches most civil servants:

1. **Days 1-5**: Salary arrives. You feel rich.
2. **Days 6-15**: Bills paid. You feel okay.
3. **Days 16-25**: Tight. You borrow a small Airtel Money loan.
4. **Days 26-30**: Salary arrives again. The cycle repeats.

After 12 months of this cycle, you''ve paid K1,800 in Airtel Money interest and saved K0.

**That''s the trap. Not poverty — discipline.**

## Why the trap exists

1. **Lifestyle inflation**: Each raise increases spending proportionally. You don''t get richer; you just spend more.
2. **Social pressure**: Relatives, "friends", community obligations. The moment you get a raise, 10 people know.
3. **Lack of buffer**: Without an emergency fund, every surprise (car repair, hospital, school fees) becomes a loan.
4. **Mobile money is too easy**: A K500 loan in 30 seconds. The interest is small, but the cycle is devastating.

## How to escape — the 24-hour rule

For the next 90 days, apply this to every non-essential purchase over K100:

1. **See something you want** (clothes, phone upgrade, fancy meal)
2. **Wait 24 hours**
3. If after 24 hours you still want it AND can afford it (without touching your emergency fund), buy it
4. If you forgot about it, you saved money

This single rule will save you K2,000-K5,000 over 90 days.

## The 50/30/20 rule for civil servants

Once your net pay arrives, split it like this:

- **50% Needs** (rent, school fees, food, transport to work)
- **30% Wants** (entertainment, dining out, personal items)
- **20% Savings** (BISWIC contributions, NAPSA top-up, emergency fund)

If 20% feels impossible, start with 5% and grow by 1% per month. After 12 months, you''re at 17% without feeling the pinch.

## The "pay yourself first" rule

Before paying any bill, transfer K100 (or 10% of your net) to a separate savings account you don''t touch. The money is **gone before you see it** — and that prevents the lifestyle-inflation trap.

The order matters:
1. **Pay yourself first** (BISWIC + emergency fund)
2. Then pay needs
3. Then pay wants

## Three concrete steps to start today

1. **Open a separate savings account** (or use a mobile money wallet you don''t touch). Set up auto-transfer of K100 on payday.
2. **Track your spending for 30 days.** Use notebook, spreadsheet, or your banking app. You''ll be shocked at what you spend K50-K200 on that you forgot.
3. **Commit to BISWIC contributions.** K100/month = K1,200/year in your name. After 10 years (with bucket growth), that''s a serious sum.

> "The salary trap is a discipline problem, not an income problem. You can earn K50,000 a month and still be broke. Or earn K5,000 and be financially free."', 7)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Mastering Your Civil Servant Salary — Quiz', 75)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'NAPSA is deducted at what percentage of basic pay?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), '2%', false, 1),
      ((SELECT id FROM q0), '5%', true, 2),
      ((SELECT id FROM q0), '10%', false, 3),
      ((SELECT id FROM q0), '15%', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'You earn K9,000/month gross. Approximately how much PAYE will you pay? (Use 2024 indicative bands: 0% up to K5,100, 20% K5,100–K7,100, 30% K7,100–K9,200, 37.5% above K9,200.)', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'K0', false, 1),
      ((SELECT id FROM q1), 'K900', false, 2),
      ((SELECT id FROM q1), 'K1,300', true, 3),
      ((SELECT id FROM q1), 'K2,500', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'The 50/30/20 rule says you should put what percentage of net pay into savings?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), '10%', false, 1),
      ((SELECT id FROM q2), '15%', false, 2),
      ((SELECT id FROM q2), '20%', true, 3),
      ((SELECT id FROM q2), '30%', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'Why is PAYE called a "marginal" tax?', 'MULTIPLE_CHOICE',
       'Marginal means each portion of income is taxed at the rate for that band, not the whole amount at the highest rate.', 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'Because it is deducted from the side (margin) of your payslip', false, 1),
      ((SELECT id FROM q3), 'Because each portion of income is taxed at the rate for that band, not the whole amount at the highest rate', true, 2),
      ((SELECT id FROM q3), 'Because it can be avoided by working less', false, 3),
      ((SELECT id FROM q3), 'Because it is paid at the end of the year', false, 4)
    RETURNING 1
  ),
  q4 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 5, 'Why is the "salary trap" a discipline problem and not just an income problem?', 'MULTIPLE_CHOICE',
       'The trap is created by lifestyle inflation, social pressure, and lack of emergency fund — not by the salary amount itself.', 1)
    RETURNING "id"
  ),
  o4 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q4), 'Civil servants are paid less than they deserve', false, 1),
      ((SELECT id FROM q4), 'Even a K50,000 salary can leave you broke if you spend it all', true, 2),
      ((SELECT id FROM q4), 'You can only escape by getting a second job', false, 3),
      ((SELECT id FROM q4), 'The government will eventually raise civil servant salaries', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- debt-trap-mobile-money-sakawa -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('debt-trap-mobile-money-sakawa', 'The Debt Trap: Mobile Money Loans, Sakawa & Pyramid Schemes', 'The single biggest financial threat to Zambian civil servants is not low income — it is predatory debt. Learn to spot the traps BEFORE you enter them.',
       'The single biggest financial threat to Zambian civil servants is not low income — it is predatory debt. Learn to spot the traps BEFORE you enter them.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 7, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'Why civil servants are the #1 target for predatory lenders', '# Why civil servants are the #1 target for predatory lenders

If you are a Zambian civil servant, you are a **target**. Predatory lenders — mobile money operators, "kacha loan" sharks, Sakawa scammers, pyramid schemes — actively seek you out. Here''s why:

## The reason: predictable, garnishable income

Unlike market traders or self-employed people, you have:
- A **fixed monthly salary** paid on the 28th-ish of every month
- A salary that **cannot easily be hidden** (your employer deducts at source)
- An employer who **must honor** a court order to deduct from your salary

This makes you a "safe bet" for lenders. They know you''ll pay back because your employer will help them take it from your pay.

## The cycle of predatory lending

Here''s how a typical mobile money loan plays out:

1. **Day 1**: You borrow K500 from Airtel Money. Fee: K75 (15%). You receive K425.
2. **Day 14**: You owe K575. You can repay K575 or roll over.
3. **Day 28**: Salary arrives. Auto-deduct takes K575 from your Airtel Money wallet.
4. **Result**: 2 weeks of "liquidity" cost you K75. Annualized: **390% per year**.

Compare to:
- **BISWIC soft loan**: 5% per annum
- **Bank loan**: 25-35% per annum
- **NAPSA housing loan**: 9-12% per annum

Airtel Money loans are 10× more expensive than a bank loan and 78× more expensive than BISWIC.

## Common predatory products targeting civil servants

1. **Mobile money loans** (Airtel Money, MTN MoMo) — 10-15% per 2 weeks
2. **Payday loans** (microfinance dressed up) — 20-30% per month
3. **Salary advances** from informal lenders — 25-50% per month
4. **"Investment groups"** (cash circle / "kutapa") — last in, first out, mostly Ponzi
5. **Sakawa** (advance-fee fraud) — "send K500 to receive K5,000"
6. **MLM / pyramid schemes** — recruitment is the product
7. **"Blessing circles"** — religious-themed Ponzi
8. **Cryptocurrency "guaranteed returns"** — guaranteed loss
9. **Land scams** — "buy this plot in Libala South for K50,000, will be K500,000 in 2 years"
10. **Vehicle hire-purchase** — repossessed at the first missed payment, plus 30% interest

## Why "kacha loans" are the worst

A "kacha" loan is a loan from a private individual (often a colleague or ex-colleague) at 50-100% per month. The interest compounds. Within 3 months, you owe double.

**Worst case**: A K1,000 kacha loan at 50%/month becomes K13,500 in 3 months. They send "agents" to your office. They threaten your family. They file criminal charges. Your reputation and career are at risk.

## The single most important rule

**Borrow only at rates below 15% per year.** Period.

| Source | Approx rate | OK? |
| --- | --- | --- |
| BISWIC soft loan | 5% p.a. | ✅ Yes |
| NAPSA housing loan | 9-12% p.a. | ✅ Yes |
| Bank loan (collateral) | 25-35% p.a. | ⚠️ Acceptable for big-ticket needs |
| Hire-purchase (vehicle) | 20-30% p.a. | ⚠️ Only if essential |
| Airtel Money / MTN MoMo loan | 390% p.a. | ❌ Never |
| Payday loan | 240-360% p.a. | ❌ Never |
| Kacha loan | 600-1200% p.a. | ❌ Never |

## If you are already in a debt trap

1. **List all debts**: amount, who, interest rate, monthly payment
2. **Stop new borrowing** — no exceptions for 90 days
3. **Negotiate**: most lenders will accept 50% lump-sum settlement rather than chase you
4. **Use the BISWIC FUNERAL bucket as leverage**: it shows creditors you have a safety net
5. **Consider a debt consolidation loan** through a real bank (NATS, Bayport, etc.) at 25-30% to pay off all the 390% loans

> "The most expensive money in Zambia is the kind you borrow when you don''t have to. And the most dangerous lender is the one who calls you a ''friend''."', 8),
      ((SELECT id FROM m), 2, 'Sakawa, MMM-style pyramids, and the "K100 → K50,000" lie', '# Sakawa, MMM-style pyramids, and the "K100 → K50,000" lie

Zambia has been hit hard by every global Ponzi scheme plus a few local flavors. Most civil servants who fall for these are not stupid — they are trusting, hopeful, and under financial pressure. The schemes are designed to exploit exactly that.

## What is Sakawa?

"Sakawa" is a West African term that has come to mean **advance-fee fraud** in Zambia. The classic version:

> "Send K500 to this number, and you will receive K5,000 in 24 hours."

There is no K5,000. The K500 is the entire profit. Once you send it, the scammer:
- Blocks your number
- Sends you to a "level 2" agent who promises bigger returns for more money
- Or posts your number in a "successful clients" group to lure more victims

**No legitimate business in Zambia asks you to send money to receive money.** Period. Full stop.

## MMM-style pyramid schemes

A Russian scheme called MMM collapsed in 2017, but its clones keep appearing in Zambia:

> "Invest K1,000 today. Get K1,500 in 7 days. Invite 2 friends, get K3,000 in 14 days."

The math doesn''t work. In a true Ponzi, the only people who get paid are the first 5-10%. Everyone else loses. By the time you hear about it, the early joiners have been paid (using YOUR money), and you''re now the exit liquidity.

## The "blessing circle" / "cash circle" scam

Common in churches, especially in Zambia:

> "Join our K500 circle. Every week, the pot grows. After 10 weeks, you receive K5,000!"

The reality: you''re in a queue. The first people get paid by the last people. When new recruitment slows, the queue stalls, and the latecomers (you) lose everything.

Some are genuinely well-meaning (rotating savings — "chilimba"). But the line between "chilimba" and "pyramid" is whether the **organizer takes a cut**. If they do, it''s a pyramid.

## How to spot a scam in 60 seconds

Ask these 5 questions:

1. **Where does the return come from?** If the answer is "from new investors" or "from referrals" — it''s a Ponzi. Legit returns come from real economic activity (a business selling things, a loan being repaid).
2. **Is the return "guaranteed" or "fixed"?** Real investments have variable returns. "Fixed 50% per month" is always a scam.
3. **Is the operator registered with SEC / Bank of Zambia?** Check the Securities and Exchange Commission and Bank of Zambia websites.
4. **Can you withdraw your principal at any time?** If not, your money is locked in — and so is the scam operator.
5. **Are you being pressured to recruit others?** Legit businesses pay for products sold, not for recruitment.

If any answer is suspicious: walk away.

## The 5 scams I see most often in Zambia

1. **"Send K200 to get K2,000 in 30 minutes"** — advance-fee fraud
2. **"Pay K5,000 to join our investment club, earn K10,000 monthly"** — Ponzi
3. **"Buy a K50,000 plot in [rural area], will be worth K500,000 in 2 years"** — land speculation scam
4. **"Crypto arbitrage: invest K10,000, get K50,000 in 30 days"** — Ponzi
5. **"Blessing circle for 5 weeks, get 6× your money back"** — pyramid

## The "red flag" checklist

| Sign | Means |
| --- | --- |
| "Limited time offer" | Classic pressure tactic |
| "Just K500 to start" | Designed to seem small |
| "Already 200 members" | Suggests popularity (lies) |
| "Bank transfer only / no checks" | Avoids paper trail |
| "Don''t tell your family" | They know it''s a scam |
| "God will multiply it" | Using faith to scam |
| "10% per week" | Unsustainable |

## What to do if you''re already in a scam

1. **Stop sending money** — even if they promise "one more payment unlocks everything." This is the trap.
2. **Document everything** — screenshots, transaction IDs, names
3. **Report to police** (Anti-Fraud Unit, Lusaka) — they may not recover money but the report helps others
4. **Tell someone you trust** — shame keeps people in scams; honesty gets you out
5. **Forgive yourself** — many smart, educated people fall for these. Learn and move on.

## The replace-the-urge rule

When you feel the urge to invest in a "too good to be true" scheme, do this instead:

1. **Wait 7 days** (the urgency is the trick)
2. **Tell a friend** what you were about to do
3. **If after 7 days you still want to** AND you can afford to lose 100% of it, you may proceed

Almost no scam survives a 7-day wait.

> "If you can''t afford to lose 100% of what you''re about to invest, you can''t afford to invest. The biggest scam in Zambia is not Sakawa — it''s the illusion that wealth comes without work."', 9),
      ((SELECT id FROM m), 3, 'How to escape a debt spiral (the 90-day reset)', '# How to escape a debt spiral (the 90-day reset)

If you''re already in a debt spiral — multiple loans, payday advances, kacha loans, salary garnishes — there is a way out. It''s hard, but it works. Here''s the 90-day plan.

## Day 1: The honest list

Get a notebook. Write down:
- Each debt: name, total amount owed, interest rate, monthly minimum, total months remaining
- For each: when is the next payment due
- For each: what happens if you miss a payment (penalty? court?)

Don''t lie to yourself. Don''t hide anything. The list IS the first step.

## Day 2: Stop the bleeding

No new borrowing. **No exceptions.** This includes:
- No "small" Airtel Money loans
- No "I''ll pay it back next month" advances
- No "just this once" requests
- No "but it''s a really good deal" purchases

If you have a kacha loan shark calling, change your number temporarily. Tell your family. Get support.

## Day 3-7: The 4-question triage

For each debt, answer:
1. **Is it legitimate?** (signed contract, real interest rate, real business)
2. **Is it illegal or predatory?** (kacha loan, Sakawa, no paperwork)
3. **What''s the consequence of not paying?** (credit damage, court, garnishee)
4. **Can I negotiate a settlement?** (most lenders will accept 30-50% lump sum)

Most civil servants have a mix of legitimate (bank loan, BISWIC soft loan) and predatory (kacha, mobile money). Address the predatory ones first.

## Day 8-14: The negotiation round

For each predatory debt:
- Call the lender. Be calm. Be honest.
- "I owe you K5,000. I can pay you K2,500 this week as full settlement. Take it or leave it."
- If they refuse, you have leverage: most kacha lenders don''t have paperwork. They can''t take you to court.
- If they threaten, get witness statements from family. Report to police if you fear for your safety.

For legitimate debts (bank loans):
- Call the bank''s collections department
- Ask for hardship restructuring: "I can pay K800/month instead of K1,500 for 6 months, then back to K1,500"
- Most banks will agree. They''d rather restructure than write off.

## Day 15-30: The budget reset

Use a 50/30/20 budget (50% needs, 30% wants, 20% debt extra):
- For the next 90 days, put 20% of net pay into a separate "debt freedom" account
- Use this account ONLY to pay off the highest-interest debt
- Once a debt is paid off, roll its minimum payment into the debt freedom account (the "debt avalanche" method)

## Day 30-60: The first payoffs

After 30 days, you should have a small "debt freedom" fund. Use it to pay off the smallest debt entirely (the "snowball" method) — this gives you a quick psychological win and frees up cash flow.

Example:
- Debt A: K500 Airtel Money (15% / 2 weeks = 390% annualized) — pay this FIRST
- Debt B: K3,000 bank loan (30% p.a.) — pay this SECOND
- Debt C: K5,000 BISWIC soft loan (5% p.a.) — pay this LAST (cheapest)

Pay off A first (smallest, highest rate). Then B. Then C. The "freed up" minimum payment from each paid-off debt rolls into the next payoff.

## Day 60-90: The rollover

By now you should have 1-2 debts completely gone. Your cash flow is better. Keep going.

After 90 days, review:
- Total debt remaining
- Total interest paid this quarter
- Next 3 months of debt freedom plan
- Habits to prevent re-entry (no new loans, emergency fund in place)

## The 5 rules of debt freedom

1. **No new borrowing.** Period.
2. **Highest interest first.** Always.
3. **Smallest balance first** (snowball) if motivation is the bottleneck.
4. **Negotiate everything.** Lenders want to settle more than you think.
5. **Build an emergency fund** so you never need to borrow again.

## What if you have a court case / salary garnishee?

1. **Don''t ignore it.** Court orders are real. Garnishees are real.
2. **Hire a lawyer** — most lawyers in Lusaka will consult for K500. The Lawyer''s Association of Zambia can recommend one.
3. **Negotiate a payment plan** with the plaintiff through your lawyer. Courts prefer small regular payments over non-payment.
4. **Apply to have the garnishee limited** to a percentage of your salary that lets you live (usually max 30%).

> "The fastest way out of debt is to stop adding to it. The second fastest is to attack the highest-rate debt with everything you''ve got."', 8)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'The Debt Trap — Quiz', 80)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'A K500 Airtel Money loan at 15% for 2 weeks has an annualized rate of approximately:', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), '15% per year', false, 1),
      ((SELECT id FROM q0), '90% per year', false, 2),
      ((SELECT id FROM q0), '390% per year', true, 3),
      ((SELECT id FROM q0), '900% per year', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'You are offered an "investment" that pays 50% per month. Which sign of a scam is this?', 'MULTIPLE_CHOICE',
       '"Fixed high return" with no underlying business activity is the textbook definition of a Ponzi.', 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'It is registered with SEC', false, 1),
      ((SELECT id FROM q1), 'You can withdraw your principal at any time', false, 2),
      ((SELECT id FROM q1), 'The promised return is "fixed" and far above bank rates', true, 3),
      ((SELECT id FROM q1), 'The operator has a physical office', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'What is the "debt snowball" method?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'Pay off the highest-interest debt first', false, 1),
      ((SELECT id FROM q2), 'Pay off the smallest-balance debt first', true, 2),
      ((SELECT id FROM q2), 'Refinance all debts into one loan', false, 3),
      ((SELECT id FROM q2), 'Borrow more to pay off less', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'A "kacha" loan is:', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'A government-subsidized loan for civil servants', false, 1),
      ((SELECT id FROM q3), 'A short-term loan from an informal lender, often at 50-100% per month', true, 2),
      ((SELECT id FROM q3), 'A type of NAPSA loan', false, 3),
      ((SELECT id FROM q3), 'A bank loan from a Zambian commercial bank', false, 4)
    RETURNING 1
  ),
  q4 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 5, 'Someone offers you a "blessing circle" — you put in K500, after 10 weeks you get K5,000. The first 5 weeks pay earlier members, but new recruitment slows at week 6. What happens?', 'MULTIPLE_CHOICE',
       'In a pyramid, the latecomers always lose when the queue stalls.', 1)
    RETURNING "id"
  ),
  o4 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q4), 'You get paid because the organizer covers the gap', false, 1),
      ((SELECT id FROM q4), 'You lose your K500 (and possibly the next 4 weeks of payments too)', true, 2),
      ((SELECT id FROM q4), 'You get partial payment based on the remaining pot', false, 3),
      ((SELECT id FROM q4), 'You can sue the organizer for the full K5,000', false, 4)
    RETURNING 1
  ),
  q5 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 6, 'What is the maximum rate of interest you should accept on any loan?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o5 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q5), '5% per year', false, 1),
      ((SELECT id FROM q5), '15% per year', false, 2),
      ((SELECT id FROM q5), '30% per year (only for big-ticket needs like a house)', true, 3),
      ((SELECT id FROM q5), '50% per year if you really need the money', false, 4)
    RETURNING 1
  ),
  q6 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 7, 'Which of the following are signs of a Sakawa / advance-fee scam? (Select all that apply)', 'MULTI_SELECT',
       NULL, 1)
    RETURNING "id"
  ),
  o6 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q6), '"Send K500 to receive K5,000 in 24 hours"', true, 1),
      ((SELECT id FROM q6), 'Bank transfer only / no checks', true, 2),
      ((SELECT id FROM q6), '"Don''t tell your family"', true, 3),
      ((SELECT id FROM q6), 'Bank of Zambia registration with a license number', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- emergency-fund-three-month-safety-net -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('emergency-fund-three-month-safety-net', 'Building Your 3-Month Emergency Fund', 'The difference between one bad month and a financial catastrophe is having K2,000-K15,000 in cash you can reach in 24 hours. Here is how to build it from K0.',
       'The difference between one bad month and a financial catastrophe is having K2,000-K15,000 in cash you can reach in 24 hours. Here is how to build it from K0.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 8, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'What an emergency fund is (and is not)', '# What an emergency fund is (and is not)

An **emergency fund** is cash set aside for genuine emergencies — money you can reach in 24 hours without borrowing, selling, or asking.

## What an emergency fund IS

- Money in a **separate** account (not your everyday wallet)
- Enough to cover **3 months of essential expenses** (rent, food, school fees, transport)
- **Accessible within 24 hours** (a bank account, not locked in property)
- **Untouched** except for genuine emergencies
- Owned by you, in your name, in Zambia

## What an emergency fund is NOT

- ❌ Money in your Airtel Money main wallet (you''ll spend it)
- ❌ Money given to a friend to "keep for you" (you''ll ask for it back)
- ❌ Money in a fixed deposit that takes 30 days to break (too slow)
- ❌ Money in stocks or crypto (value can drop when you need it most)
- ❌ Your BISWIC contribution (this is your savings, not your emergency fund)
- ❌ A "promise" from a relative to send you money "next month"

## How much should it be?

The rule of thumb: **3 months of essential expenses**.

| Your monthly essentials | Target emergency fund |
| --- | --- |
| K3,000 | K9,000 |
| K5,000 | K15,000 |
| K8,000 | K24,000 |
| K10,000 | K30,000 |

If K30,000 feels impossible, start with **K2,000** as the "first milestone" (covers most small emergencies — car repair, hospital visit, school top-up), then build to 1 month, then 3 months.

## Why 3 months specifically?

- Most emergencies (car repair, hospital, funeral travel) resolve within 1-2 months
- Job loss (which can happen even to civil servants during restructuring) typically takes 2-4 months to recover
- 3 months gives you **breathing room** to make a smart decision instead of a panicked one

## The "jar method" — Zambian version

In the West, people use the "cash envelope" method. In Zambia, we have a similar approach:

- **Open a separate mobile money wallet** (or a separate bank savings account) JUST for emergencies
- Label it clearly: "EMERGENCY ONLY"
- Auto-transfer K50-K200 from your main wallet on payday
- **Do not use it for anything except emergencies**

## What counts as an "emergency"?

✅ Yes:
- Car broke down, can''t get to work
- Hospital bill (not routine, but actual emergency)
- Job loss (need 1-3 months to find new work)
- House roof blown off in storm
- Funeral travel (unplanned, urgent)

❌ No:
- New phone
- "Sale" at the shop
- Holiday
- Wedding gift
- "Investment opportunity"
- Helping a friend (use your generosity budget instead, not emergency fund)

## The discipline

The hardest part is **leaving it alone**. Treat your emergency fund like a fire extinguisher — you don''t touch it until there''s a real fire. If you use it for non-emergencies, you''ll never build it up again.

> "The day your car breaks down is not the day to start saving for car repairs. The day you have K5,000 in a separate account is the day you stop borrowing for car repairs."', 6),
      ((SELECT id FROM m), 2, 'How to build it from K0 in 6-12 months', '# How to build it from K0 in 6-12 months

The hardest part isn''t having the discipline to save. It''s **starting** and **sticking with it**. Here''s a 6-12 month plan to get to K5,000 (or more) from zero.

## The 6-month plan (K50/week → K1,200)

If you can spare even K50 per week (K200/month), you''ll have K1,200 in 6 months. That''s enough for a small car repair, a hospital visit, or a school fee.

- Week 1: K50
- Week 2: K100
- Week 3: K150
- ...
- Week 24: K1,200

Keep it in a **separate mobile money wallet** with a clear label. Don''t touch it.

## The 12-month plan (K100/week → K5,200)

If you can spare K100/week (K400/month), you''ll have K5,200 in 12 months. That covers 1-2 months of essentials.

- **K100/week** is roughly K25 per workday for 4 days
- One skipped takeaway coffee per week
- One fewer Airtel Money "small" loan
- Auto-transfer K400 on payday, divide by 4 weeks

## The "snowball" emergency fund builder

If you have multiple small debts, this is a clever workaround:

1. **Borrow K2,000 from BISWIC soft loan** (5% per year)
2. **Put K1,000 in your emergency fund**
3. **Keep K1,000 for actual emergencies**
4. **Pay back BISWIC** at K200/month over 10 months (5% interest = K50 total)
5. **Now you have an emergency fund AND have paid back the loan** — net cost: K50 over 10 months

This is a "use cheap debt to build an asset" strategy. Don''t borrow at 390% (mobile money) to do this — but at 5% (BISWIC), it''s brilliant.

## Where to keep it

Three options, ranked by suitability:

### 1. Separate mobile money wallet (BEST for most civil servants)
- Easy to open
- Always accessible
- No bank fees
- No minimum balance
- **Downside**: zero interest, slight risk of unauthorized access if PIN is compromised

### 2. Bank savings account (BETTER if you have one already)
- Slightly more secure
- Some banks offer 3-5% interest (e.g. ABSA, Stanbic, ZNBS)
- Bank statement is a record
- **Downside**: minimum balance requirements, bank fees, harder to access on weekends

### 3. Fixed deposit (BAD choice for emergency funds)
- Higher interest (8-10%)
- **Downside**: 30-day withdrawal notice — defeats the purpose

## The "auto-transfer" hack

Most bank apps and mobile money apps let you set up automatic transfers. On payday, automatically:
- Send K400 to your BISWIC contribution
- Send K100 to your emergency fund wallet
- Send K200 to your savings account

After 6 months of this, you''ll have K2,400 in emergencies and K2,400 in BISWIC. After 12 months: K4,800 in each.

The discipline is the **automatic** part. Don''t rely on willpower — make it so you don''t have a choice.

## What to do when an emergency actually happens

1. **Pause and assess**: Is this actually an emergency? Or is it a "want"?
2. **Use only what you need**: K3,000 car repair? Take K3,000 out, not all K5,000.
3. **Replace it within 90 days**: After the emergency is past, top the fund back up to your target.
4. **Document what happened**: Car repair, hospital, funeral. Build a mental model of what emergencies actually occur in your life.

## The "burst" pattern

Most people don''t save in a smooth line. They burst:
- January: pay day, K100 → emergency fund
- February: school fees, use K200 from emergency fund
- March: pay day, replace K200 + add K100
- April: skip (no emergency, no surplus)
- May: pay day, add K100

That''s OK. The pattern is: **add when you can, replace when you must, never go below K0**.

> "The best time to start your emergency fund was 5 years ago. The second best time is today. The third best time is right after your next unexpected expense — because you''ll be motivated."', 7)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Emergency Fund — Quiz', 70)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'How many months of essential expenses should an emergency fund cover?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), '1 week', false, 1),
      ((SELECT id FROM q0), '1 month', false, 2),
      ((SELECT id FROM q0), '3 months', true, 3),
      ((SELECT id FROM q0), '12 months', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'Which of these is an appropriate place to keep your emergency fund?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'In your main Airtel Money wallet that you use daily', false, 1),
      ((SELECT id FROM q1), 'Locked in a 12-month fixed deposit', false, 2),
      ((SELECT id FROM q1), 'A separate mobile money wallet labelled "EMERGENCY ONLY"', true, 3),
      ((SELECT id FROM q1), 'Given to a trusted family member for safekeeping', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'Which of the following is a genuine emergency that justifies using your emergency fund?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'A friend asks for a loan and promises to pay back next month', false, 1),
      ((SELECT id FROM q2), 'Your car broke down and you cannot get to work', true, 2),
      ((SELECT id FROM q2), 'A new phone is on sale at a great price', false, 3),
      ((SELECT id FROM q2), 'You want to take a holiday', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'You can save K100/week. How much will you have in 12 months?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'K1,200', false, 1),
      ((SELECT id FROM q3), 'K5,200', true, 2),
      ((SELECT id FROM q3), 'K10,000', false, 3),
      ((SELECT id FROM q3), 'K12,000', false, 4)
    RETURNING 1
  ),
  q4 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 5, 'You used K2,000 from your emergency fund for a hospital bill. What should you do next?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o4 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q4), 'Leave the fund at the lower amount; emergencies are rare', false, 1),
      ((SELECT id FROM q4), 'Top it back up to your target within 90 days', true, 2),
      ((SELECT id FROM q4), 'Borrow K2,000 from the bank to refill it', false, 3),
      ((SELECT id FROM q4), 'Wait until next year to refill it', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- napsa-retirement-maximize-benefits -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('napsa-retirement-maximize-benefits', 'NAPSA & Retirement: How to Maximize Your Benefits', 'Your NAPSA contributions are not "just a deduction" — they are your retirement. Learn the vesting rules, withdrawal options, and how to maximize the payout.',
       'Your NAPSA contributions are not "just a deduction" — they are your retirement. Learn the vesting rules, withdrawal options, and how to maximize the payout.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 9, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'How NAPSA works (and why your 5% matters)', '# How NAPSA works (and why your 5% matters)

NAPSA (National Pension Scheme Authority) is the Zambian statutory pension scheme. Almost every civil servant is a member. Understanding it is critical to your long-term financial security.

## The basic mechanics

- **You contribute 5%** of your monthly basic pay
- **Your employer contributes 5%** matching (so 10% total per month)
- The contributions are pooled and invested by NAPSA
- At retirement, you receive a monthly pension based on your contributions + investment returns

## The vesting period (this is critical)

You must contribute for **at least 10 years (120 months)** to qualify for a pension. If you leave before 10 years:
- You only get back your **own contributions** (5%)
- You do NOT get the employer''s 5% match
- You do NOT get any investment returns

**Translation**: If you work for 8 years and quit, you get back roughly what you put in, with no growth. If you work for 15 years, you get a monthly pension for life.

## Why 10 years matters

The 10-year vesting is a powerful incentive to **stay in civil service long-term** (or at least, in NAPSA-covered employment). It also means:

- If you change jobs, keep paying into NAPSA via your new employer (if applicable)
- If you go self-employed, **voluntary contributions** are possible
- If you emigrate, NAPSA has rules for that too

## How your pension is calculated

NAPSA uses a formula based on:
- Your average salary over the highest-paid 5 years
- Your total years of contribution
- A multiplier (changes periodically; check current NAPSA rate)

**Indicative example**: A civil servant on grade 7 with 25 years of service, averaging K8,000/month in the last 5 years, would receive approximately K4,000-5,000/month pension for life.

This is not enough to live on. That''s why **NAPSA is your floor, not your ceiling** — you need additional retirement savings on top.

## The "NAPSA ceiling" trap

There''s a salary ceiling for NAPSA contributions (currently around K30,000/month). If you earn more than this, you don''t contribute more. But you also don''t get a proportionally larger pension.

Strategy: build private retirement savings (pension funds, real estate, BISWIC buckets) for the income above the NAPSA ceiling.

## The early-withdrawal rules

You can withdraw your NAPSA before retirement in limited circumstances:
- **Age 50 with 10+ years**: partial withdrawal allowed
- **Permanent emigration**: full withdrawal of your contributions
- **Total permanent disability**: full withdrawal
- **Death**: paid to your nominated beneficiary

**Important**: These are YOUR contributions only (5% of what you paid in). You don''t get the employer''s 5% or investment returns on early withdrawal. So early withdrawal is almost always a bad financial decision.

## The "forget to nominate" mistake

When you joined NAPSA, you nominated a beneficiary. If you''ve forgotten or never did, **do it now**. The form is on the NAPSA website and takes 10 minutes.

Without a beneficiary, your NAPSA goes to your estate — which means months of probate before your family sees a kwacha.

## Voluntary Additional Contributions (VACs)

Beyond the mandatory 5%, you can make **Voluntary Additional Contributions** to NAPSA. These grow at NAPSA''s investment rate (historically 4-7% per year) and increase your eventual pension.

For a civil servant on grade 7 earning K8,000, contributing an extra 5% (K400/month) for 20 years could add K200,000-300,000 to your retirement pot.

## The 3 things every civil servant must do

1. **Verify your contributions are being deducted** — check your payslip every month
2. **Nominate (and update) your beneficiary** — re-check every 5 years
3. **Check your annual NAPSA statement** — NAPSA sends these; if you don''t get one, contact them

> "Your 5% isn''t a tax. It''s your retirement. Treat it with the same respect you treat your house, your car, and your children."', 8),
      ((SELECT id FROM m), 2, 'How to build retirement income on top of NAPSA', '# How to build retirement income on top of NAPSA

NAPSA is necessary but insufficient. For most civil servants, it covers 30-50% of pre-retirement income. To retire comfortably, you need additional streams. Here''s how Zambian civil servants typically do it.

## The 4-pillar retirement plan

| Pillar | Source | Typical % of retirement income |
| --- | --- | --- |
| 1. NAPSA | Statutory pension | 30-50% |
| 2. Private pension / occupational scheme | Voluntary contributions | 20-30% |
| 3. Investments (real estate, equity, BISWIC) | Your savings | 15-30% |
| 4. Side income / family support | Continuing work | 10-25% |

Most civil servants start with Pillar 1 only and add Pillars 2-4 over time.

## Pillar 2: Private pensions

Zambia has licensed pension fund schemes:
- **ZPSM** (Zambia Private Sector Mobilization)
- **NAPSA** also offers voluntary additional contributions
- **Bank-managed pension products** (e.g. Stanbic, ZNBS)

These typically offer 5-10% annual returns and tax-advantaged growth. Good for civil servants who want set-and-forget retirement savings.

## Pillar 3: Investments

The most powerful retirement builder, if done right.

### Real estate
- Buy land in developing areas (Lusaka, Kitwe, Ndola outskirts)
- Hold for 10-20 years
- Use rental income to supplement NAPSA pension
- **Risk**: liquidity is low. You can''t sell a plot in 24 hours.

### Cooperative buckets (BISWIC)
- Your LAND bucket becomes retirement income when the cooperative develops land
- The BUSINESS bucket may yield dividends
- The MEDIAN investment horizon is 5-10 years
- **Risk**: tied to cooperative performance

### Stocks and bonds
- LuSE (Lusaka Stock Exchange) offers shares in Zambian companies
- Government bonds yield 12-22% per year
- **Risk**: requires financial literacy, not for beginners

### Side businesses
- Small enterprise (poultry, retail, transport)
- Higher risk but potentially highest return
- Requires time and effort to run

## The "10% rule" for retirement

Whatever you contribute to NAPSA (currently 5% of basic), contribute **the same amount** to private retirement savings. So if you''re contributing K400/month to NAPSA, contribute another K400/month to:
- A private pension fund
- BISWIC contribution (the LAND bucket is your retirement)
- A government bond

After 25 years at K800/month (K400 NAPSA + K400 private), with 7% average growth, you''ll have approximately K900,000 in retirement savings — enough to draw K5,000/month for 15+ years.

## The "step-up" strategy

Increase your private retirement contribution by 1% of your pay each year. This way:
- Year 1: 5% (just NAPSA)
- Year 2: 6% (5% NAPSA + 1% private)
- Year 3: 7% (5% NAPSA + 2% private)
- ...
- Year 10: 14% total retirement contribution

By year 10, you''re saving 14% of pay, but it feels natural because each increase was small.

## The "retirement age" reality in Zambia

Statutory retirement age for civil servants: **55**. Most civil servants can expect to live 25+ years after retirement. That''s a long time to fund on a NAPSA pension alone.

Plan: at retirement, you need enough private savings to draw **70-80% of your pre-retirement income** for 25 years.

## The "early retirement" option

If you have enough private savings (typically 25x your annual expenses saved up), you can retire before 55. Few civil servants reach this, but it''s an option.

Realistic target: 60% of civil servants retire at 55 with insufficient savings, relying on family support and continuing to work in some capacity.

Don''t be that statistic.

## The "second career" plan

Many retired civil servants:
- Start small businesses (consulting, farming, retail)
- Take advisory roles
- Continue in part-time employment

If you plan for a "second career" in retirement, you don''t need to save as much. A K4,000/month NAPSA + K3,000/month from a small business = K7,000/month total — which is most civil servants'' net pay.

> "Retirement is not a number. It''s a lifestyle. The civil servant who saves K500/month for 20 years will retire to a different life than the one who spent it all."', 8)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'NAPSA & Retirement — Quiz', 75)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'How long must you contribute to NAPSA to qualify for a pension?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), '5 years', false, 1),
      ((SELECT id FROM q0), '10 years', true, 2),
      ((SELECT id FROM q0), '15 years', false, 3),
      ((SELECT id FROM q0), '20 years', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'Your monthly NAPSA contribution is what percentage of your basic pay?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), '2%', false, 1),
      ((SELECT id FROM q1), '5%', true, 2),
      ((SELECT id FROM q1), '10%', false, 3),
      ((SELECT id FROM q1), '15%', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'You leave civil service after 8 years. What do you get back from NAPSA?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'Full pension for life', false, 1),
      ((SELECT id FROM q2), 'Your 5% contributions back, no employer match, no investment returns', true, 2),
      ((SELECT id FROM q2), '10% of your contributions (both employee and employer)', false, 3),
      ((SELECT id FROM q2), 'Nothing — you forfeit it all', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'Why is NAPSA considered your "floor" not your "ceiling" for retirement?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'Because it only pays the minimum wage', false, 1),
      ((SELECT id FROM q3), 'Because it caps at K5,000/month no matter what you earned', false, 2),
      ((SELECT id FROM q3), 'Because the pension is typically only 30-50% of your pre-retirement income, so you need other savings', true, 3),
      ((SELECT id FROM q3), 'Because the law prevents it from paying more', false, 4)
    RETURNING 1
  ),
  q4 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 5, 'You do NOT have a NAPSA beneficiary nominated. What happens if you die?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o4 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q4), 'Your spouse automatically receives it', false, 1),
      ((SELECT id FROM q4), 'It is paid to the cooperative', false, 2),
      ((SELECT id FROM q4), 'It goes to your estate and may take months of probate to release', true, 3),
      ((SELECT id FROM q4), 'It is forfeited', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- banking-zambia-hidden-costs -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('banking-zambia-hidden-costs', 'Banking in Zambia: Hidden Costs & Smart Choices', 'A bank account is more than a place to keep money. Learn which banks to use, what fees to avoid, and how to keep your money safe from fraud.',
       'A bank account is more than a place to keep money. Learn which banks to use, what fees to avoid, and how to keep your money safe from fraud.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 10, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'Choosing a Zambian bank: the 6 main options compared', '# Choosing a Zambian bank: the 6 main options compared

Zambia has 14+ commercial banks. Most civil servants end up at one of the big 6 by default. Here''s an honest comparison.

## The big 6

### 1. Zanaco (Zambia National Commercial Bank)
- **Owned by**: Government of Zambia (majority)
- **Strengths**: government salary accounts, large ATM network, low fees
- **Weaknesses**: slow digital innovation, queues
- **Best for**: civil servants who want simple, low-fee banking
- **Typical fee**: K5-15 per withdrawal, no monthly fee on basic savings

### 2. ABSA Bank Zambia
- **Owned by**: Absa Group (South Africa)
- **Strengths**: good mobile app, large ATM network, modern
- **Weaknesses**: higher fees, minimum balance requirements
- **Best for**: tech-savvy users who want good digital banking
- **Typical fee**: K15-25 per withdrawal, K50-100 monthly fee on some accounts

### 3. Standard Chartered Bank Zambia
- **Owned by**: Standard Chartered (UK/Hong Kong)
- **Strengths**: premium service, international transfers, expat-friendly
- **Weaknesses**: highest fees, minimum balance K5,000+
- **Best for**: senior civil servants with international remittances
- **Typical fee**: K30-50 per withdrawal, K200+ monthly fee

### 4. Stanbic Bank Zambia
- **Owned by**: Standard Bank Group (South Africa)
- **Strengths**: solid digital platform, good loan products
- **Weaknesses**: medium fees, customer service can be slow
- **Best for**: those wanting loans (mortgages, vehicles)
- **Typical fee**: K15-30 per withdrawal, K50-100 monthly fee

### 5. First National Bank (FNB) Zambia
- **Owned by**: FirstRand (South Africa)
- **Strengths**: best mobile app, low fees, innovative
- **Weaknesses**: smaller ATM network, less branch coverage
- **Best for**: those who want the best digital experience
- **Typical fee**: K5-15 per withdrawal, low monthly fees

### 6. United Bank for Africa (UBA) Zambia
- **Owned by**: UBA Group (Nigeria)
- **Strengths**: pan-African, decent digital platform
- **Weaknesses**: smaller in Zambia
- **Best for**: those with banking needs across Africa
- **Typical fee**: K10-20 per withdrawal

## How to choose

Ask yourself:

1. **Where does my salary go?** Most civil servants are paid through Zanaco. If yours is, just use Zanaco (no transfer fees, easy loans against salary).
2. **Do I need international transfers?** Standard Chartered is the easiest. FNB and ABSA are also good.
3. **Do I need a good mobile app?** FNB > ABSA > Stanbic. Zanaco is the weakest digitally.
4. **Do I want a loan?** Stanbic, ABSA, and Standard Chartered have the best loan products.
5. **What fees am I paying?** Run the math. If you withdraw K1,000 four times a month, fees add up.

## The "two-account" strategy

Most financially savvy civil servants have two bank accounts:
- **Account 1: salary account** at Zanaco (no fees on incoming salary)
- **Account 2: high-interest savings** at FNB or ABSA (3-5% interest)

Flow: salary → Account 1 → auto-transfer K500/week to Account 2 (emergency fund + retirement).

## Mobile money vs bank

For small daily transactions, **mobile money wins**:
- Airtel Money: K0.10-0.50 per transaction
- MTN MoMo: similar

For larger amounts and savings, **banks win**:
- Better security (FDIC-equivalent insurance up to K500,000 at some banks)
- Interest on balance
- Statements for record-keeping
- Loan access

## The "no bank" civil servant

Some civil servants operate entirely on mobile money. This works for daily expenses, but:
- No interest on your balance
- Vulnerable to phone theft / PIN compromise
- No formal record for tax or loan applications
- Limits loan access

Recommendation: have at least one bank account, even if you use mobile money for daily transactions.

## When to switch banks

- **If your fee is more than 1% of your balance per month** — you''re losing money
- **If your bank has no mobile app** — you''re wasting time in queues
- **If your bank has had security incidents** — move your money
- **If a better bank offers a sign-up bonus** — small carrots are OK

> "Your bank is a tool, not a relationship. Use the one that costs you least for the services you actually use."', 7),
      ((SELECT id FROM m), 2, 'Mobile money: how to use it without losing to fees', '# Mobile money: how to use it without losing to fees

Mobile money is the backbone of Zambian financial life. Used well, it''s fast and cheap. Used badly, it can drain your account.

## The fees (approximate, 2024)

| Transaction | Airtel Money | MTN MoMo |
| --- | --- | --- |
| Send to another wallet | 1-2% | 1-2% |
| Send to bank | 1-3% | 1-3% |
| Withdraw at agent | 1-2% | 1-2% |
| Withdraw at ATM | K2-5 flat | K2-5 flat |
| Pay merchant | 0.5-1% | 0.5-1% |
| Buy airtime/data | 0% | 0% |
| **Loan fee (2 weeks)** | **15%** | **15%** |
| **Loan fee (1 month)** | **30%+** | **30%+** |

## The 5 mobile money mistakes to avoid

### 1. The "small" daily withdrawal
- Withdrawing K50/day at 1.5% fee = K0.75/day
- Over 30 days = K22.50/month
- Over a year = K270 wasted
- **Fix**: Withdraw once a week, larger amounts

### 2. Keeping all your money in mobile money
- Mobile money gives 0% interest
- No FDIC-equivalent insurance
- Phone theft = total loss
- **Fix**: Keep 1-2 weeks of expenses in mobile money; rest in bank

### 3. The "let me just borrow K500 quickly"
- This is the gateway to the 390% APR debt trap
- 90% of "small" mobile money loans become a cycle
- **Fix**: If you need K500, transfer from your bank (1% fee), never borrow (390% effective APR)

### 4. Sending money to "friends" without confirming
- SIM swap fraud: someone takes over your number and drains your wallet
- Fake "agent" messages asking for PIN
- "Sakawa" via mobile money
- **Fix**: Never share PIN. Verify recipient by calling them. Treat any "official" message asking for PIN as fraud.

### 5. Ignoring the "unauthorized transaction" notice
- If you see a transaction you didn''t make, report within 24 hours
- After 24 hours, mobile money operators may deny liability
- **Fix**: Check your wallet daily. Report immediately.

## The "mobile money budget" trick

Set a monthly limit for mobile money transactions:
- Cash withdrawals: K100 max per week
- Send money: K200 max per day
- Loan: K0 (NEVER)

If you stay within these limits, you can never lose more than K2,000/month to mobile money fees.

## The "sakawa" red flags (mobile money versions)

- "Send K500 to receive K5,000" — never
- "Agent double-pay, send back the extra" — never
- "Your number won a prize, send K200 to claim" — never
- "Urgent: your account will be deactivated, send K100 to keep active" — never
- "Family emergency in another country, send K5,000" — verify by phone call

## The 3-number system

Have three mobile money numbers:
- **Personal**: for your own use, linked to your main bank
- **Family/emergency**: for receiving transfers from family
- **Business**: for receiving payments for side work

Each has a different PIN. Compromising one doesn''t affect the others.

## How to recover from a lost/stolen phone

1. **Call your mobile money provider immediately** to suspend the wallet
2. **Call your bank** to freeze linked accounts
3. **Get a new SIM** at the provider''s office (with ID)
4. **Change all PINs** (mobile money, bank, email)
5. **Review recent transactions** for any you didn''t make
6. **File a police report** if money was stolen (required for insurance claims)

Time is critical. The first 24 hours matter most.

> "Mobile money is the most democratic financial tool in Zambia. Used wisely, it''s powerful. Used carelessly, it bleeds you dry one small transaction at a time."', 7)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Banking in Zambia — Quiz', 70)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'Which Zambian bank is government-owned and is where most civil servant salaries are paid?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), 'ABSA', false, 1),
      ((SELECT id FROM q0), 'Stanbic', false, 2),
      ((SELECT id FROM q0), 'Zanaco', true, 3),
      ((SELECT id FROM q0), 'FNB', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'You withdraw K50 from mobile money every day. Approximately how much do you lose in fees per year?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'K0 (mobile money has no fees)', false, 1),
      ((SELECT id FROM q1), 'K50', false, 2),
      ((SELECT id FROM q1), 'K270', true, 3),
      ((SELECT id FROM q1), 'K5,000', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'What should you do if you receive an SMS saying "Your account will be deactivated, send K100 to keep active"?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'Send the K100 immediately', false, 1),
      ((SELECT id FROM q2), 'Call the official number on the back of your card to verify', true, 2),
      ((SELECT id FROM q2), 'Reply to the SMS with your account number', false, 3),
      ((SELECT id FROM q2), 'Forward the SMS to friends as a warning', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'Why is keeping all your money in mobile money risky?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'Mobile money is illegal in Zambia', false, 1),
      ((SELECT id FROM q3), 'You earn 0% interest, no FDIC insurance, and phone theft means total loss', true, 2),
      ((SELECT id FROM q3), 'Mobile money can only hold K1,000 at a time', false, 3),
      ((SELECT id FROM q3), 'Mobile money accounts are frozen on weekends', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- insurance-risk-protection-civil-servants -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('insurance-risk-protection-civil-servants', 'Insurance & Risk Protection for Civil Servants', 'One hospital stay can wipe out 5 years of savings. Understand NHIMA, group life, and personal insurance so a disaster does not become a financial catastrophe.',
       'One hospital stay can wipe out 5 years of savings. Understand NHIMA, group life, and personal insurance so a disaster does not become a financial catastrophe.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 11, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'Why insurance is the most underused tool by civil servants', '# Why insurance is the most underused tool by civil servants

Insurance is the most boring, most expensive, most important financial product most civil servants ignore. Until they need it. Then it''s too late.

## The reality

In Zambia, most civil servants:
- Have **no health insurance** beyond NHIMA (and even NHIMA is misunderstood)
- Have **no life insurance** (relying on the cooperative''s FUNERAL bucket for K1,500, which is rarely enough)
- Have **no disability insurance** (the most catastrophic)
- Have **no property insurance** (if their house burns, they''re ruined)

This is despite the fact that most civil servants can afford at least basic insurance if they prioritize it.

## The 4 types of insurance every civil servant needs

### 1. Health insurance
- Covers hospital bills, surgery, medication
- In Zambia: NHIMA is the public option; private schemes (Madison, Professional Insurance) are the private options
- Without it: a 3-day hospital stay can cost K3,000-K10,000 out of pocket

### 2. Life insurance
- Pays out a lump sum to your family on death
- Critical because the FUNERAL bucket (K1,500) is not enough
- Term life (cheap) vs whole life (expensive) — start with term

### 3. Disability insurance
- If you can''t work due to illness/injury, this replaces some of your income
- **Most underused and most important for civil servants**: a single accident or chronic illness can end your career
- Harder to get once you''re already ill

### 4. Property insurance
- Covers your home, car, electronics against fire, theft, flood
- Most civil servants'' homes are NOT insured
- A fire that destroys your home is a financial catastrophe without insurance

## The "insurance is a waste" myth

Many civil servants think insurance is a waste because they never claim. This is backwards. Insurance works because:
- **You pay small amounts** (K100-500/month)
- **You get a large amount** (K50,000-500,000) **when you need it**
- **Most years you "lose"** — but the one year you need it, you win big

The "waste" is the cost of certainty. Like a seatbelt — most days you don''t need it. The one day you do, you REALLY need it.

## NHIMA — what you need to know

NHIMA (National Health Insurance Management Authority) is the mandatory health insurance for:
- All civil servants (1% of basic pay, deducted at source)
- All formal-sector employees
- Some informal-sector workers (voluntary)

**What it covers**:
- Inpatient hospital care (public hospitals, some private)
- Limited outpatient care
- Some medications on the NHIMA formulary
- Maternity care

**What it does NOT cover**:
- Most private hospital bills
- Many specialized drugs
- Dental, optical, cosmetic
- Treatments outside Zambia

**Reality check**: NHIMA is better than nothing, but it''s not comprehensive. Most civil servants with serious illness pay significant out-of-pocket even with NHIMA.

## The "gap" insurance solution

For full coverage, you need NHIMA + a private top-up:
- **NHIMA**: 1% of basic pay (mandatory) — covers the basics
- **Private health insurance**: K200-1,000/month — covers the gap

For a civil servant on K8,000/month:
- NHIMA: K80/month (mandatory)
- Private health top-up: K300-500/month
- Total: K380-580/month
- Coverage: up to K1,000,000/year in medical expenses

## Life insurance for civil servants

Term life insurance is the cheapest and most useful. For a 35-year-old civil servant:
- K1,000,000 death benefit: K200-400/month
- K5,000,000 death benefit: K1,000-2,000/month

If you have a family that depends on your income, term life is non-negotiable. If you die without it, your family is left with NAPSA (paid monthly, not lump sum) and the cooperative''s K1,500.

## The "funeral vs life insurance" distinction

- **FUNERAL bucket** (BISWIC): K1,500 lump sum for funeral expenses
- **Life insurance**: K1,000,000+ to your family, can be used for anything

Don''t confuse them. The FUNERAL bucket covers the funeral. Life insurance covers your family''s future.

## What about NHIMA''s coverage of pre-existing conditions?

NHIMA generally covers pre-existing conditions after a waiting period (often 6 months). Private insurers may exclude or surcharge. If you have a known health issue, lock in coverage BEFORE you need it.

> "Insurance is the one thing you buy hoping you''ll never use it. The day you need it, you''ll be glad you bought it. The day you don''t need it, the premiums felt like a waste — and that''s the whole point."', 8)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Insurance & Risk Protection — Quiz', 70)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'NHIMA is mandatory for civil servants. How much is the contribution?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), '0.5% of basic pay', false, 1),
      ((SELECT id FROM q0), '1% of basic pay', true, 2),
      ((SELECT id FROM q0), '3% of basic pay', false, 3),
      ((SELECT id FROM q0), '5% of basic pay', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'What is the difference between the cooperative FUNERAL bucket and life insurance?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'They are the same thing', false, 1),
      ((SELECT id FROM q1), 'FUNERAL bucket pays K1,500 for funeral; life insurance pays K1M+ to family for any use', true, 2),
      ((SELECT id FROM q1), 'Life insurance is only for retirees', false, 3),
      ((SELECT id FROM q1), 'FUNERAL bucket is for old members only', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'Why is "I never claimed, so insurance is a waste" the wrong way to think about insurance?', 'MULTIPLE_CHOICE',
       'Insurance works because you pay small amounts for protection against rare but catastrophic events.', 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'Insurance is always a waste', false, 1),
      ((SELECT id FROM q2), 'You pay small amounts regularly to be protected against rare but catastrophic events', true, 2),
      ((SELECT id FROM q2), 'Insurance only pays out on birthdays', false, 3),
      ((SELECT id FROM q2), 'Insurance is required by law', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- why-biswic-is-your-best-investment -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('why-biswic-is-your-best-investment', 'Why Your Cooperative is Your Best Investment', 'For most Zambian civil servants, the cooperative is the best financial deal they will ever see. Here is the math and the strategy.',
       'For most Zambian civil servants, the cooperative is the best financial deal they will ever see. Here is the math and the strategy.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 12, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'The 5% return that beats the bank', '# The 5% return that beats the bank

Most civil servants don''t realize it, but their BISWIC contribution may be their **best investment**. Here''s why.

## The return comparison

| Investment | Typical annual return | Risk |
| --- | --- | --- |
| BISWIC soft loan interest (charged to borrowers) | 5% p.a. | Very low (peer-to-peer) |
| Zambia bank savings | 2-4% p.a. | Very low |
| Zambian government bonds | 12-22% p.a. | Low |
| LuSE stocks (long-term avg) | 8-15% p.a. | Medium |
| Real estate (Lusaka) | 8-20% p.a. | Medium |
| Airtel Money loan (charged) | -390% p.a. | Very low (but destroys you) |
| **BISWIC contribution to your name** | **5%+ p.a. effective** | **Very low** |

When you contribute K100 to BISWIC, you get:
- ✅ Welfare coverage (FUNERAL, MEDICAL) for you and your family
- ✅ Soft loan access at 5% (vs 390% from mobile money)
- ✅ Business development upside
- ✅ Land acquisition potential
- ✅ A growing pool of member savings

The "return" is hard to put a number on, but it''s substantial.

## The K100/month compound

If you contribute K100/month for 25 years to a bucket that grows 5% per year:
- Total contributions: K30,000
- Plus growth: ~K20,000
- Total: K50,000+

That K50,000 is also your soft-loan collateral. If you ever need K30,000 for a real emergency, BISWIC will lend it to you at 5% (vs 390% from mobile money).

## The soft loan arbitrage

Most BISWIC members don''t think of their contribution as an "investment" because there''s no obvious equity-style return. But there''s a hidden arbitrage:

- You contribute K100/month = K1,200/year
- The soft loan bucket lends at 5% p.a.
- The interest paid by borrowers comes back to the bucket
- The bucket''s value grows over time
- At retirement, you have a sizeable soft loan entitlement (the bucket balance × your contribution share)

## The "cooperative advantage" in numbers

A civil servant with K1,200 in annual BISWIC contributions for 10 years has:
- K12,000 in personal contributions
- Plus K1,200+ in cumulative interest (at 5% over 10 years)
- Plus access to K50,000-200,000 in soft loans (depending on bucket balance)
- Plus welfare coverage for K1,500 funeral + K2,000 medical
- Plus business and land upside

That''s a return of multiple times what they put in — but it''s hard to value precisely because it comes in different forms.

## What BISWIC is NOT

To be fair:
- **Not a get-rich-quick scheme**: returns are slow, in the 5% range
- **Not a substitute for private savings**: you still need emergency fund + retirement outside the cooperative
- **Not without risk**: cooperative governance matters. Bad management = bad outcomes
- **Not liquid**: you can''t withdraw your contributions on demand (you can request a withdrawal in specific circumstances, but it''s not like a bank account)

## The comparison: what K100/month buys you elsewhere

| Where | What you get |
| --- | --- |
| Bank savings (5% p.a.) | K1,200 → K1,237 after 1 year. Can withdraw anytime. |
| Government bond (15% p.a.) | K1,200 → K1,380 after 1 year. Locked for 1 year. |
| Mobile money wallet (0%) | K1,200 → K1,200. Tempting to spend. |
| Airtel Money loan (reversed: -390% p.a.) | You borrow K1,200, owe K1,668 in 2 weeks. |
| **BISWIC** | **K1,200 → welfare cover + soft loan access + bucket share** |

The BISWIC "return" is hard to put a number on, but it''s the best deal in the cooperative''s portfolio.

## How to maximize your BISWIC benefit

1. **Contribute consistently** — K100 every month, no exceptions
2. **Use the soft loan for emergencies only** — not lifestyle
3. **Attend AGMs** — vote for good governance
4. **Take advantage of welfare** — when you have a funeral or medical need, USE the FUNERAL/MEDICAL bucket
5. **Help grow the cooperative** — bring in new members, support business ventures

> "Your K100/month is the best financial deal most Zambian civil servants will ever see. The only thing that beats it is K200/month."', 7)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Why Your Cooperative is Your Best Investment — Quiz', 70)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'What is the soft loan interest rate BISWIC charges borrowers?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), '0%', false, 1),
      ((SELECT id FROM q0), '5% per annum', true, 2),
      ((SELECT id FROM q0), '20% per annum', false, 3),
      ((SELECT id FROM q0), '50% per annum', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'How do you "get a return" on your BISWIC contribution?', 'MULTI_SELECT',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'Welfare coverage when you need it', true, 1),
      ((SELECT id FROM q1), 'Access to low-cost soft loans', true, 2),
      ((SELECT id FROM q1), 'Share in business and land development', true, 3),
      ((SELECT id FROM q1), 'A guaranteed K10,000 dividend every year', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'You contribute K100/month for 25 years. Approximately how much will you have paid in (not counting interest)?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'K1,200', false, 1),
      ((SELECT id FROM q2), 'K12,000', false, 2),
      ((SELECT id FROM q2), 'K30,000', true, 3),
      ((SELECT id FROM q2), 'K60,000', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- avoiding-scams-sakawa-kachalo-pyramids -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('avoiding-scams-sakawa-kachalo-pyramids', 'Avoiding Scams: Sakawa, Kachalo & Pyramid Schemes in Zambia', 'Zambia is fertile ground for every kind of fraud. Learn the 10 most common scams, how to spot them in 60 seconds, and what to do if you (or a family member) have already lost money.',
       'Zambia is fertile ground for every kind of fraud. Learn the 10 most common scams, how to spot them in 60 seconds, and what to do if you (or a family member) have already lost money.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 13, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'The 10 most common scams in Zambia (and how to spot them)', '# The 10 most common scams in Zambia (and how to spot them)

Zambia is one of the most-targeted countries in Africa for fraud because of:
- High mobile money adoption (easy to send money to anyone)
- Low financial literacy (easy targets)
- Trust-based culture (Zambians tend to trust)
- High unemployment (desperation creates vulnerability)

Here are the 10 scams I see most often, ranked by damage to civil servants.

## 1. Sakawa (advance-fee fraud)

**The pitch**: "Send K500 to receive K5,000 in 24 hours."

**The reality**: The K5,000 doesn''t exist. You lose the K500. Often escalates: "Send another K2,000 to unlock the larger prize."

**The tell**: Any message that asks for money to receive money is fraud. No exceptions.

**How to avoid**: Never. Never ever. Even "just to see."

## 2. MMM-style Ponzi / "Blessing circle"

**The pitch**: "Invest K1,000. Get K1,500 in 7 days. Recruit 2 friends, get K3,000."

**The reality**: Early joiners are paid with new joiners'' money. When recruitment slows, the scheme collapses. Most people lose everything.

**The tell**: Returns come from "recruitment" or "member growth," not real economic activity.

**How to avoid**: Ask "where does the return come from?" If the answer involves new investors, walk away.

## 3. Land scams

**The pitch**: "Buy this plot in Libala South for K50,000. It''ll be worth K500,000 in 2 years."

**The reality**: Many "plots" are in areas with no development planned. The "appreciation" is fantasy. Some are outright fraud (no land exists, fake title).

**The tell**: No infrastructure, no confirmed buyer demand, "guaranteed" appreciation.

**How to avoid**: Verify with the Ministry of Lands. Buy only in areas with confirmed development. BISWIC''s LAND bucket is the safer cooperative alternative.

## 4. Crypto "guaranteed returns"

**The pitch**: "Invest K10,000 in our crypto arbitrage fund. Guaranteed 30% per month."

**The reality**: No such thing as guaranteed crypto returns. Real crypto is volatile; fake crypto funds are just Ponzi schemes.

**The tell**: "Guaranteed" returns. Pressure to recruit others.

**How to avoid**: If you don''t understand it, don''t invest.

## 5. Kachalo loans (loan shark)

**The pitch**: A "colleague" or "friend" offers you a quick loan at "low interest" — actually 50-100% per month.

**The reality**: Compound interest traps you. The "friend" turns hostile when you miss a payment.

**The tell**: Interest rate higher than 15% per year. No paperwork. Threats if you ask questions.

**How to avoid**: If a friend offers you money at 50% per month, they''re not your friend. Use BISWIC (5%) or a real bank (25-30%).

## 6. Vehicle hire-purchase repossession

**The pitch**: "Drive away today for K2,000/month. After 36 months, it''s yours."

**The reality**: Miss one payment, the car is gone. You''re still on the hook for the balance. And the interest rate is 25-30%.

**The tell**: 0% deposit, low monthly, no questions asked.

**How to avoid**: Save up 30-50% deposit. Use a real bank loan. Or buy a cheaper car outright.

## 7. "Blessing" or "covenant" offerings

**The pitch**: A pastor/prophet says "Give me K5,000, God will multiply it to K50,000."

**The reality**: The pastor has a new car. You don''t.

**The tell**: Any "investment" that requires you to give money to a religious figure for a guaranteed return. Genuine faith is about relationship, not ROI.

**How to avoid**: Religious leaders should never promise financial returns. Period.

## 8. SIM swap fraud

**The pitch**: You get a "your SIM is being deactivated" SMS. You call a number. They ask for your details. They take over your number. They drain your mobile money.

**The reality**: They have your number. They reset your bank/mobile money passwords. They take everything.

**The tell**: Unexpected SMS about SIM deactivation. Always.

**How to avoid**: Never call numbers from unsolicited SMS. Go to your provider''s official office if your SIM has an issue.

## 9. Fake jobs (advance-fee "employment")

**The pitch**: "You''ve been shortlisted for a K15,000/month job. Pay K500 for the application form."

**The reality**: No job. They have your K500 and your ID details (often used for further fraud).

**The tell**: You didn''t apply, you were "shortlisted." Pay to apply.

**How to avoid**: Real jobs never ask for money upfront.

## 10. "Relatives in distress" (BEC)

**The pitch**: "Hi Uncle, I''m stuck at the airport, please send K2,000 urgently, will pay back when I land."

**The reality**: Your nephew''s WhatsApp was hacked. The K2,000 goes to a scammer in Nigeria.

**The tell**: Urgency + money request. Doesn''t match how your nephew normally talks.

**How to avoid**: Call the relative directly. Don''t trust SMS/WhatsApp requests for money, especially urgent ones.

## The 60-second scam-detection test

For any "opportunity" or "request," ask:

1. **Is this too good to be true?** If yes, it''s a scam.
2. **Does it pressure me to act NOW?** Scammers use urgency.
3. **Does it ask me to send money to receive money?** Always fraud.
4. **Does it promise "guaranteed" returns?** No such thing.
5. **Is it from someone I know, but asking in a way they don''t normally act?** Verify by another channel.

If any answer is yes: walk away.

## What to do if you''ve been scammed

1. **Stop sending money** — even if they promise "one more unlocks everything"
2. **Document** — screenshots, transaction IDs, names, numbers
3. **Report to police** — Lusaka has a Cyber Crime Unit; not always productive, but it creates a record
4. **Tell family/friends** — shame keeps people in scams
5. **Forgive yourself** — many educated, smart Zambians fall for these

> "The best protection against scams is not more information. It''s the willingness to be skeptical. If your gut says ''this feels off,'' trust the gut."', 9)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Avoiding Scams — Quiz', 80)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'You receive an SMS: "Your SIM will be deactivated in 24 hours. Call 0977XXXXXX to keep active." What do you do?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), 'Call the number immediately', false, 1),
      ((SELECT id FROM q0), 'Ignore it (or visit your provider''s official office to verify)', true, 2),
      ((SELECT id FROM q0), 'Reply with your ID number', false, 3),
      ((SELECT id FROM q0), 'Send K100 to extend your SIM', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'A pastor says "Give me K5,000, God will give you K50,000 in 7 days." What is this?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'A genuine blessing', false, 1),
      ((SELECT id FROM q1), 'A religious investment opportunity', false, 2),
      ((SELECT id FROM q1), 'A Sakawa / advance-fee scam dressed in religious clothing', true, 3),
      ((SELECT id FROM q1), 'A government program', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'Which of the following are signs of a Ponzi scheme?', 'MULTI_SELECT',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'Returns come from new investors, not real economic activity', true, 1),
      ((SELECT id FROM q2), 'You are pressured to recruit others', true, 2),
      ((SELECT id FROM q2), 'Returns are "guaranteed" with no risk', true, 3),
      ((SELECT id FROM q2), 'The company is registered with SEC and audited annually', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'A "friend" offers to lend you K2,000 at "just 50% per month, but we will work something out." What is this?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'A generous offer from a friend', false, 1),
      ((SELECT id FROM q3), 'A kachalo loan that will trap you in debt (use BISWIC at 5% instead)', true, 2),
      ((SELECT id FROM q3), 'A normal bank loan', false, 3),
      ((SELECT id FROM q3), 'A government grant', false, 4)
    RETURNING 1
  ),
  q4 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 5, 'A WhatsApp message from your "nephew" asks for K3,000 urgently saying he is stuck at the airport. What do you do?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o4 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q4), 'Send the K3,000 immediately', false, 1),
      ((SELECT id FROM q4), 'Call your nephew directly on his known number to verify before sending', true, 2),
      ((SELECT id FROM q4), 'Ask for the nephew''s bank details and send via mobile money', false, 3),
      ((SELECT id FROM q4), 'Send K1,000 first to test', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- property-land-generational-wealth -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('property-land-generational-wealth', 'Property & Land: Building Wealth You Can Pass Down', 'For most Zambians, the path to generational wealth runs through land. Learn to buy safely, avoid scams, and build a portfolio you can pass to your children.',
       'For most Zambians, the path to generational wealth runs through land. Learn to buy safely, avoid scams, and build a portfolio you can pass to your children.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 14, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'Why land is the only inflation-beating asset most Zambians can buy', '# Why land is the only inflation-beating asset most Zambians can buy

In Zambia, land has historically appreciated faster than inflation. From 2010 to 2024:
- Lusaka average land prices grew from K50/sqm to K500/sqm (10× in 14 years = ~18% per year)
- Ndola, Kitwe, and Livingstone have similar trajectories
- Rural customary land is harder to value but also appreciates

This is much faster than:
- Bank savings: 2-4% per year
- Stocks: 8-15% per year (with high volatility)
- Bonds: 12-22% per year (but capped and not appreciating capital)

**Land wins for Zambian civil servants** because:
1. ✅ You can buy it with savings (K50,000-K200,000 typical)
2. ✅ You can use it for your own home
3. ✅ You can rent it out for income
4. ✅ You can sell it for capital gains
5. ✅ It appreciates faster than inflation
6. ✅ You can pass it to your children

## The 3 types of land ownership in Zambia

### 1. Customary land
- Owned by the chief/headman, allocated to families
- Cannot be sold to outsiders (but can be transferred to other Zambians in some cases)
- Cannot be used as collateral for bank loans
- Most rural Zambians live on customary land
- **For retirement: not great as an investment, but you can build a home**

### 2. Leasehold land (99-year lease from the government)
- The most common title for urban/suburban plots
- You "own" the lease for 99 years
- Can be sold, transferred, inherited
- Can be used as collateral for bank loans
- **For retirement: ideal — you can sell, mortgage, or pass to children**

### 3. Freehold land
- Full ownership, perpetual
- Rare in Zambia
- Most common for very old properties or specific commercial areas
- **For retirement: best, but rare and expensive**

## The "5-year hold" rule for land

Land in Zambia typically doubles in price every 5-7 years in growth areas. The longer you hold, the more it appreciates. Resist the temptation to sell after 2-3 years unless you need the money urgently.

## How to buy land safely (avoiding the scams)

1. **Verify the title**: Go to the Ministry of Lands in Lusaka (or provincial HQ) and run a title search. Costs K50-K200, takes 2-4 weeks, but it''s the ONLY way to confirm ownership.
2. **Use a registered surveyor**: Don''t trust verbal boundaries. A surveyor will mark the actual plot with beacons.
3. **Use a lawyer for the transfer**: Land transfers in Zambia require a lawyer to register with the Ministry of Lands.
4. **Pay via bank transfer**: Never pay cash for land. The bank record is your proof.
5. **Avoid "too cheap" deals**: If the price is 50% below market, it''s likely fraud or a dispute.

## The "BISWIC LAND bucket" advantage

Your cooperative''s LAND bucket is a **collective** version of the same strategy:
- Pool K100/month from 60+ members = K6,000+/month
- Use the pool to acquire larger plots than any individual could
- Members benefit from appreciation
- The cooperative absorbs the risk of one plot being a dud

For most civil servants, contributing to the LAND bucket is a lower-risk way to participate in land appreciation than buying individually.

## When to buy land

- **Don''t** buy land if you have high-interest debt
- **Don''t** buy land if you don''t have an emergency fund
- **Don''t** buy land if your retirement savings are inadequate
- **Do** buy land after you have 3 months of expenses saved, low-interest debt, and some retirement savings
- **Do** buy land if you can afford to hold for 5+ years

## The 4 properties to consider (in order)

1. **Your own home** (residential leasehold) — pay off as fast as possible
2. **A rental property** in a growth area — generates monthly income
3. **Land for future development** (commercial) — speculative, higher risk
4. **Agricultural land** (rural) — long-term food security, low maintenance

Most civil servants should focus on (1) and (2).

## The "land inheritance" rule

Without a will, your land can be tied up in probate for years. Even if you have a verbal understanding with your family, formalize it:

1. **Write a will** that names who gets which property
2. **Register the will** with the local court
3. **Keep copies** with the Ministry of Lands and a trusted lawyer
4. **Tell your family** about the will

The K500 you spend on a proper will saves your family K50,000 in legal fees after you die.

## The "BISWIC LAND" alternative for those who can''t buy individually

If K100,000 for a plot is beyond your reach, the BISWIC LAND bucket is the answer. As a member, your share of the LAND bucket grows over time. If the cooperative buys 10 plots over 10 years, you have a share in those plots. At retirement, you can either:
- Receive your share in cash
- Receive a plot in the cooperative''s development
- Keep your membership and continue benefiting

> "The civil servant who buys one plot in their 30s and holds it until retirement is the civil servant who retires with dignity. The civil servant who spends it all on Kachalo loans is the one who retires asking family for help."', 8)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Property & Land — Quiz', 70)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'You are offered a plot in a "developing area" for K30,000 — far below market. What should you do FIRST?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), 'Pay cash and take the title', false, 1),
      ((SELECT id FROM q0), 'Run a title search at the Ministry of Lands and use a registered surveyor', true, 2),
      ((SELECT id FROM q0), 'Trust the seller and pay via mobile money', false, 3),
      ((SELECT id FROM q0), 'Ask the seller for a discount', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'What is the most common form of land ownership in urban Zambia?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'Customary land', false, 1),
      ((SELECT id FROM q1), '99-year leasehold', true, 2),
      ((SELECT id FROM q1), 'Freehold', false, 3),
      ((SELECT id FROM q1), 'Customary lease', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'Why is buying land through the cooperative LAND bucket often safer than buying individually?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'It is illegal to buy land individually', false, 1),
      ((SELECT id FROM q2), 'The cooperative can afford larger plots, diversifies risk, and amortizes the surveyor/lawyer costs', true, 2),
      ((SELECT id FROM q2), 'You can never sell individual plots', false, 3),
      ((SELECT id FROM q2), 'Government subsidies cover 50% of the cost', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'When should you AVOID buying land?', 'MULTI_SELECT',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'You have high-interest debt', true, 1),
      ((SELECT id FROM q3), 'You do not have a 3-month emergency fund', true, 2),
      ((SELECT id FROM q3), 'Your retirement savings are inadequate', true, 3),
      ((SELECT id FROM q3), 'You have a stable job and 6 months of expenses saved', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

-- ----- teaching-family-generational-wealth -----
WITH
  m AS (
    INSERT INTO "LearningModule"
      ("slug", "title", "summary", "content", "audience", "isPublished", "order", "updatedAt")
    VALUES
      ('teaching-family-generational-wealth', 'Teaching Your Family About Money: Generational Wealth', 'The most important financial skill you can teach your children is NOT saving — it is thinking. Build a family financial culture that outlasts you.',
       'The most important financial skill you can teach your children is NOT saving — it is thinking. Build a family financial culture that outlasts you.', ARRAY['MEMBER', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'FW', 'SECRETARY', 'TREASURER', 'DEPUTY_TREASURER', 'CCD']::"Role"[],
       true, 15, now())
    ON CONFLICT ("slug") DO UPDATE SET
      "title"       = EXCLUDED."title",
      "summary"     = EXCLUDED."summary",
      "content"     = EXCLUDED."content",
      "audience"    = EXCLUDED."audience",
      "isPublished" = EXCLUDED."isPublished",
      "order"       = EXCLUDED."order",
      "updatedAt"   = now()
    RETURNING "id"
  ),
  dl AS (
    DELETE FROM "LearningLesson"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  il AS (
    INSERT INTO "LearningLesson"
      ("moduleId", "order", "title", "content", "estimatedMin")
    VALUES
      ((SELECT id FROM m), 1, 'The "money talk" most Zambian families never have', '# The "money talk" most Zambian families never have

Most Zambian families don''t talk about money. It''s considered rude, embarrassing, or "private." This silence is one of the biggest reasons generational wealth doesn''t pass on.

## The cost of silence

When parents don''t teach their children about money, the children learn by accident:
- They see the parents spend and assume that''s the right way
- They see debt normalized (parents always borrowing) and copy it
- They see "Kachalo" as normal and don''t know better
- They see relatives ask for money and feel entitled to do the same
- They see no savings, no investments, no plan

After 30 years, the children are in the same financial position as the parents were. **The cycle repeats.**

## What to tell your children (by age)

### Ages 5-8: "Money is something you trade for things"
- Let them handle cash for small purchases
- Use 3 jars: Save, Spend, Share
- Show them prices when shopping
- Don''t hide money discussions

### Ages 9-12: "Saving is the magic that makes money grow"
- Open a youth savings account (some banks offer this)
- Match their savings (K5 they save, you add K5)
- Let them set their own savings goals (a toy, a game)
- Celebrate when they reach a goal

### Ages 13-17: "The difference between needs and wants is discipline"
- Give them a small monthly allowance
- Don''t rescue them when they run out
- Explain credit cards and mobile money loans (in age-appropriate terms)
- Introduce the concept of compound interest

### Ages 18-22: "Income, expenses, savings, and the trap of lifestyle inflation"
- Walk them through your payslip (if comfortable)
- Help them set up a budget
- Encourage them to start retirement savings early (even K50/month)
- Warn them about Sakawa and pyramid schemes
- Talk about credit scores and how they affect loans

### Adults: "Wills, inheritance, and family meetings"
- Have a will
- Talk to your adult children about your financial plans
- Hold a family meeting (informal is fine) to discuss your wishes
- Identify the financially-savvy child who can help others in the family

## The 3-jar system (works for adults too)

When money comes in (salary, gift, bonus), split it into 3 mental buckets:
- **Spend** (60%) — daily needs
- **Save** (30%) — emergency fund + retirement
- **Give** (10%) — extended family, charity, religious obligations

The "give" bucket is important in Zambian culture. But make sure you give from a position of strength, not poverty. If you give K500 and you''re broke, you''ve harmed both yourself and your family.

## The "family loan" trap

In Zambian culture, family is expected to help family. This is beautiful, but it''s also a major source of financial drain.

Common scenarios:
- "Your cousin needs school fees" — you send K1,000
- "Your sister has a hospital bill" — you send K500
- "Your brother needs help with a small business" — you send K2,000
- "Your uncle has a funeral" — you send K500
- "Your aunt needs a loan for a small emergency" — you send K1,000

After 12 months, you''ve sent K15,000 to family. None of it was planned. You''re broke.

**The fix**: budget for family help. K500/month is a reasonable amount for most civil servants. When a request comes, you can say "yes" within your budget, or "no" if it''s not.

## The "yes" framework for family requests

When a family member asks for money, respond in 4 steps:

1. **Acknowledge**: "I hear you, this is important."
2. **Clarify**: "How much do you need? For what? By when?"
3. **Evaluate**: Compare to your budget. Can you afford this without compromising your essentials?
4. **Decide**: "Yes, I can give you K500 this month" or "I can''t right now, but I can help you in 2 weeks when I get paid."

**Never** give money you don''t have. **Never** go into debt for family.

## Teaching by example

The most important teaching is what your children see:
- If you budget, they learn to budget
- If you save, they learn to save
- If you avoid debt, they learn to avoid debt
- If you give thoughtfully, they learn to give thoughtfully
- If you have a will, they learn about wills

Children learn more from observation than from lectures.

## The "family meeting" approach

Once a year, ideally around January (New Year), hold a family meeting:
- Review the past year (what worked, what didn''t)
- Set goals for the new year (savings, education, health)
- Discuss any major expenses (school fees, weddings, funerals)
- Talk about wills and inheritance

This is normal in many cultures. It should be normal in Zambian families too.

## The "intergenerational wealth" goal

Real intergenerational wealth is not just land or money. It''s:
- **Habits** — children who save, budget, and avoid debt
- **Education** — children who can earn more than you did
- **Health** — children who eat well and exercise
- **Values** — children who are honest, generous, and hardworking
- **Connection** — a family that supports each other

If you raise your children with these, the money will come.

> "The most valuable inheritance you can give your children is not your land. It is the habit of saving, the discipline of budgeting, and the wisdom to know that wealth is built slowly."', 9)
    RETURNING 1
  ),
  dq AS (
    DELETE FROM "Quiz"
    WHERE "moduleId" IN (SELECT id FROM m)
    RETURNING 1
  ),
  q AS (
    INSERT INTO "Quiz"
      ("moduleId", "title", "passingScore")
    VALUES
      ((SELECT id FROM m), 'Teaching Your Family About Money — Quiz', 70)
    RETURNING "id"
  ),
  q0 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 1, 'According to the lesson, what is the most valuable inheritance you can give your children?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o0 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q0), 'A large plot of land in Lusaka', false, 1),
      ((SELECT id FROM q0), 'A paid-off house', false, 2),
      ((SELECT id FROM q0), 'Habits of saving, discipline, and wise money thinking', true, 3),
      ((SELECT id FROM q0), 'Cash savings in the bank', false, 4)
    RETURNING 1
  ),
  q1 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 2, 'A family member asks you for K2,000 urgently. What is the recommended approach?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o1 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q1), 'Send the money immediately to maintain family harmony', false, 1),
      ((SELECT id FROM q1), 'Refuse outright', false, 2),
      ((SELECT id FROM q1), 'Acknowledge, clarify, evaluate against your budget, then decide yes or no', true, 3),
      ((SELECT id FROM q1), 'Borrow from a kachalo lender to give them', false, 4)
    RETURNING 1
  ),
  q2 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 3, 'Why is the "3-jar" system (spend/save/give) useful for both children and adults?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o2 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q2), 'It is required by the Bank of Zambia', false, 1),
      ((SELECT id FROM q2), 'It forces you to give a fixed percentage before spending, preventing the trap of giving from poverty', true, 2),
      ((SELECT id FROM q2), 'It eliminates the need for a budget', false, 3),
      ((SELECT id FROM q2), 'It is the only way to save money', false, 4)
    RETURNING 1
  ),
  q3 AS (
    INSERT INTO "QuizQuestion"
      ("quizId", "order", "prompt", "type", "explanation", "points")
    VALUES
      ((SELECT id FROM q), 4, 'How often should you hold a family "money meeting" to discuss financial goals?', 'MULTIPLE_CHOICE',
       NULL, 1)
    RETURNING "id"
  ),
  o3 AS (
    INSERT INTO "QuizOption"
      ("questionId", "text", "isCorrect", "order")
    VALUES
      ((SELECT id FROM q3), 'Every week', false, 1),
      ((SELECT id FROM q3), 'Once a year (e.g. January)', true, 2),
      ((SELECT id FROM q3), 'Only when there is a crisis', false, 3),
      ((SELECT id FROM q3), 'Never — money is private', false, 4)
    RETURNING 1
  ),
  final AS (SELECT 'ok' AS status)
SELECT 1;

COMMIT;
