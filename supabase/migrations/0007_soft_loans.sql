-- =============================================================================
-- 0007 - Soft Loans module (Constitution Art. 5.5) + Welfare offset support
-- =============================================================================
-- Apply AFTER 0006, BEFORE re-deploying the app.
--
-- Adds:
--   - enum LoanStatus (PENDING | APPROVED | REJECTED | DISBURSED | REPAYING
--                      | COMPLETED | DEFAULTED)
--   - table "SoftLoan"          (the loan itself)
--   - table "SoftLoanRepayment" (the per-month repayment ledger)
--   - table "LendingSubCommittee" (3-member approval panel, Art. 5.5(d))
--   - table "DisputeCase"        (minimal queue for default escalations)
--   - column WelfareClaim.writtenConsent (Art. 5.5(f)(iii) - allow offset)
--
-- The bucket row "SOFT_LOANS" was created in 0004 (rename of EDUCATION).
-- The User relations (LoanApplicant, LendingChair, LendingMember1/2, etc.)
-- are added in the Prisma schema; the SQL here creates the tables + FKs.
-- =============================================================================

-- 1) Enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'LoanStatus') then
    create type "LoanStatus" as enum (
      'PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'REPAYING', 'COMPLETED', 'DEFAULTED'
    );
  end if;
end $$;

-- 2) SoftLoan
create table if not exists public."SoftLoan" (
  id                    uuid primary key default gen_random_uuid(),
  "applicantId"         uuid not null references public."User"(id) on delete restrict,
  principal             numeric(14, 2) not null check (principal > 0 and principal <= 3000),
  "interestRate"        numeric(5, 4)  not null default 0.0500,
  "termMonths"          int            not null check ("termMonths" >= 1 and "termMonths" <= 6),
  "monthlyPayment"      numeric(14, 2) not null,
  "totalRepayment"      numeric(14, 2) not null,
  balance               numeric(14, 2) not null default 0,
  status                "LoanStatus"   not null default 'PENDING',
  purpose               text           not null,
  "conflictDeclared"    boolean        not null default false,
  "chairApprovedAt"     timestamptz,
  "member1ApprovedAt"   timestamptz,
  "member2ApprovedAt"   timestamptz,
  "appliedAt"           timestamptz    not null default now(),
  "approvedAt"          timestamptz,
  "rejectedAt"          timestamptz,
  "rejectionReason"     text,
  "disbursedAt"         timestamptz,
  "completedAt"         timestamptz,
  "defaultedAt"         timestamptz,
  "defaultedReason"     text,
  "writtenOff"          boolean        not null default false,
  notes                 text,
  "createdAt"           timestamptz    not null default now(),
  "updatedAt"           timestamptz    not null default now()
);
create index if not exists "SoftLoan_applicantId_status_idx" on public."SoftLoan" ("applicantId", status);
create index if not exists "SoftLoan_status_idx"             on public."SoftLoan" (status);
create index if not exists "SoftLoan_defaultedAt_idx"        on public."SoftLoan" ("defaultedAt");

-- 3) SoftLoanRepayment
create table if not exists public."SoftLoanRepayment" (
  id                  uuid primary key default gen_random_uuid(),
  "loanId"            uuid not null references public."SoftLoan"(id) on delete cascade,
  "dueDate"           date not null,
  "paidAt"            timestamptz,
  "expectedPrincipal" numeric(14, 2) not null,
  "expectedInterest"  numeric(14, 2) not null,
  "paidPrincipal"     numeric(14, 2),
  "paidInterest"      numeric(14, 2),
  missed              boolean        not null default false,
  "recordedById"      uuid references public."User"(id) on delete set null,
  "createdAt"         timestamptz    not null default now(),
  "updatedAt"         timestamptz    not null default now(),
  unique ("loanId", "dueDate")
);
create index if not exists "SoftLoanRepayment_loanId_dueDate_idx" on public."SoftLoanRepayment" ("loanId", "dueDate");
create index if not exists "SoftLoanRepayment_missed_dueDate_idx" on public."SoftLoanRepayment" (missed, "dueDate");

-- 4) LendingSubCommittee
create table if not exists public."LendingSubCommittee" (
  id                          uuid primary key default gen_random_uuid(),
  "chairId"                   uuid not null references public."User"(id) on delete restrict,
  "member1Id"                 uuid not null references public."User"(id) on delete restrict,
  "member2Id"                 uuid not null references public."User"(id) on delete restrict,
  "establishedAt"             timestamptz not null default now(),
  "establishedByGmResolutionId" text,
  "isActive"                  boolean not null default true,
  "createdAt"                 timestamptz not null default now(),
  "updatedAt"                 timestamptz not null default now(),
  -- The 3 members must be distinct
  check ("chairId" <> "member1Id" and "chairId" <> "member2Id" and "member1Id" <> "member2Id")
);
-- Only one active committee at a time
create unique index if not exists "LendingSubCommittee_one_active_idx"
  on public."LendingSubCommittee" ("isActive") where "isActive" = true;

-- 5) DisputeCase (minimal)
create table if not exists public."DisputeCase" (
  id                  uuid primary key default gen_random_uuid(),
  "caseNumber"        serial,
  type                text not null,
  "subjectMemberId"   uuid references public."User"(id) on delete set null,
  "relatedEntityType" text,
  "relatedEntityId"   text,
  status              text not null default 'OPEN',
  "openedAt"          timestamptz not null default now(),
  "resolvedAt"        timestamptz,
  notes               text,
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);
create index if not exists "DisputeCase_status_idx"            on public."DisputeCase" (status);
create index if not exists "DisputeCase_subjectMemberId_idx"   on public."DisputeCase" ("subjectMemberId");
create index if not exists "DisputeCase_type_status_idx"       on public."DisputeCase" (type, status);

-- 6) WelfareClaim.writtenConsent (Art. 5.5(f)(iii))
-- When true, a future welfare payout for this claim can be reduced by the
-- member's outstanding soft loan balance.
alter table public."WelfareClaim"
  add column if not exists "writtenConsent" boolean not null default false;
