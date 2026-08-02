# BISWIC Member Platform

A Progressive Web App (PWA) for the **Brothers in Service Welfare, Land & Investment Cooperative** — a private welfare, savings, land-acquisition, and collective-investment cooperative of serving soldiers.

> **Mission:** Help serving soldiers pool monthly contributions, accumulate capital, buy land, run collective businesses, and provide capped welfare support to members and their families.

---

## Quick start (local development)

The app runs against a Supabase project (Postgres + Auth). You'll need:

1. A Supabase project (free tier is fine for dev). Grab from the dashboard:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) — server-only
   - Transaction pooler connection string (`DATABASE_URL`)

2. Copy `.env.example` to `.env` and fill in the values.

3. Apply the Supabase SQL migrations in order:
   - `supabase/migrations/0001_base.sql` — enums, pgcrypto, grants (paste into Supabase SQL Editor)
   - `pnpm prisma:generate` (no DB needed)
   - `pnpm prisma:migrate` (creates the Prisma tables)
   - `supabase/migrations/0003_post_prisma.sql` — auth sync trigger + audit log immutability (paste into Supabase SQL Editor)

4. Install + seed + run:
   ```bash
   pnpm install
   pnpm prisma:generate
   pnpm prisma:seed
   pnpm dev
   ```

Open http://localhost:3000 and sign in with one of the seeded accounts (see below).

### Seeded credentials

The seed script creates a Chair, Vice, CCD, FW, Secretary, Treasurer, Deputy Treasurer, 3 Trustees, and `config.defaultSeedMemberCount` members.

| Role | Service Number | Password |
|---|---|---|
| Chairperson | `CHAIR-001` | `ChangeMe123!` |
| Vice-Chairperson | `VICE-001` | `ChangeMe123!` |
| Chair of Capital Development | `CCD-001` | `ChangeMe123!` |
| Finance Warrant | `FW-001` | `ChangeMe123!` |
| Secretary | `SEC-001` | `ChangeMe123!` |
| Treasurer | `TR-001` | `ChangeMe123!` |
| Deputy Treasurer | `DTR-001` | `ChangeMe123!` |
| Trustee 1, 2, 3 | `TRUSTEE-001` … `TRUSTEE-003` | `ChangeMe123!` |
| Members (50 seeded) | `MEMBER-001` … `MEMBER-050` | `ChangeMe123!` |

The seed creates Supabase Auth users with email `<service-number-lowercase>@biswic.coop` and the password above. Override with `SEED_OFFICER_PASSWORD`, `SEED_MEMBER_PASSWORD`, and `SEED_EMAIL_DOMAIN` env vars.

> **Important:** Change every password before deploying to production. Use `/forgot-password` from the sign-in page.

---

## What's in the box

### 14 features (F1–F14)

| # | Feature | Status |
|---|---|---|
| F1 | Authentication (service number + password) | ✅ |
| F2 | Member Dashboard | ✅ |
| F3 | Group Dashboard | ✅ |
| F4 | Contributions module (single + bulk) | ✅ |
| F5 | Welfare Claims (with cap enforcement + 2-sig) | ✅ |
| F6 | Meetings module | ✅ |
| F7 | Documents library | ✅ |
| F8 | Notifications | ✅ |
| F9 | Audit Log (immutable viewer) | ✅ |
| F10 | Reports (monthly, yearly, statements) | ✅ |
| F11 | Land Pipeline (CCD) | ✅ (read + view) |
| F12 | Business Module (CCD) | ✅ (read + view) |
| F13 | Events & Charity | ✅ (read + view) |
| F14 | Profile & Settings | ✅ |

### 8 sacred business rules (S1–S8)

| # | Rule | Implementation |
|---|---|---|
| S1 | Bucket allocation — exact, no rounding | `src/lib/buckets.ts` (Decimal arithmetic) |
| S2 | Welfare cap enforcement | `src/lib/claim-rules.ts` + `src/server/services/claim-service.ts` |
| S3 | Two-signature rule (> K1,000) | `hasBothSignatures()` in `claim-rules.ts` |
| S4 | No cross-bucket borrowing | `claim-service.ts` — deductions only from FUNERAL/MEDICAL |
| S5 | Surplus carry-forward | `Bucket.balance` rolling forward per year |
| S6 | Audit log everything | `src/lib/audit.ts` + service wrappers |
| S7 | Member attendance rule | Schema + helper in `permissions.ts` |
| S8 | Plot allocation | Schema + runtime count from active members |

---

## Architecture

### Tech stack

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn-style components (Radix primitives)
- **DB:** Prisma on PostgreSQL (Supabase) — single database for dev and prod
- **Auth:** Supabase Auth (email + password). Login UX is "service number + password" — the server resolves service-number → email then calls `supabase.auth.signInWithPassword`. Reset-password is via `supabase.auth.resetPasswordForEmail`.
- **State:** Server components + Server Actions (no Redux/Zustand needed for Phase 1)
- **Forms:** react-hook-form + Zod validation
- **PWA:** Manifest + viewport meta (full service worker is a Phase 2 add)
- **Testing:** Vitest (unit tests for sacred rules)

### Directory structure

```
src/
├── app/                    # Next.js App Router
│   ├── login/              # F1 sign-in (service number + password)
│   ├── forgot-password/    # F1 reset-email request
│   ├── reset-password/     # F1 set new password after email link
│   ├── auth/callback/      # F1 PKCE code exchange (Supabase redirect target)
│   ├── dashboard/          # F2
│   ├── group/              # F3
│   ├── contributions/      # F4
│   ├── claims/             # F5
│   ├── meetings/           # F6
│   ├── documents/          # F7
│   ├── notifications/      # F8
│   ├── audit/              # F9
│   ├── reports/            # F10
│   ├── statement/          # F10 (personal)
│   ├── land/               # F11
│   ├── businesses/         # F12
│   ├── events/             # F13
│   ├── settings/           # F14
│   └── api/                # API routes
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── auth/               # Reset-password form
│   ├── layout/             # Sidebar, top bar, mobile nav
│   ├── dashboard/          # Bucket bars, etc.
│   ├── contributions/      # F4 forms
│   ├── claims/             # F5 forms
│   ├── settings/           # F14 forms
│   └── shared/             # Print button, etc.
├── lib/
│   ├── config.ts           # SINGLE SOURCE OF TRUTH for all cooperative params
│   ├── db.ts               # Prisma singleton
│   ├── permissions.ts      # RBAC (15 roles)
│   ├── buckets.ts          # S1 - bucket allocation
│   ├── claim-rules.ts      # S2/S3 - cap & 2-sig rules
│   ├── audit.ts            # S6 - audit log
│   ├── utils.ts            # currency, date, helpers
│   ├── supabase/           # Supabase client helpers
│   │   ├── server.ts       # createServerClient (RSC, server actions, route handlers)
│   │   ├── browser.ts      # createBrowserClient (client components)
│   │   ├── admin.ts        # SERVICE-ROLE client (server-only, never import from src/app or src/components)
│   │   ├── middleware.ts   # Session refresh helper used by /middleware.ts
│   │   └── storage.ts      # Signed URL helpers for the 'documents' bucket
│   └── auth/               # Auth helpers
│       ├── require-user.ts # getUser / requireUser / requireUserOrError
│       └── auth-attempts.ts# App-layer lockout (uses User.failedLoginAttempts + lockedUntil)
└── server/
    ├── services/
    │   ├── contribution-service.ts   # F4 + S1
    │   └── claim-service.ts          # F5 + S2/S3
    └── actions/             # Server Actions (auth, profile, contributions, claims, notifications)
prisma/
├── schema.prisma           # All models
└── seed.ts                 # Supabase-admin createUser + public upsert
supabase/
└── migrations/
    ├── 0001_base.sql       # pgcrypto + enums + grants
    ├── 0002_rls.sql        # Row Level Security
    └── 0003_post_prisma.sql# auth sync trigger + audit log immutability
middleware.ts               # Supabase session refresh on every request
tests/unit/
├── buckets.test.ts         # S1 tests
└── claim-rules.test.ts     # S2/S3 tests
```

---

## The "sacred rules" — read this before changing anything

### 1. Bucket allocation (S1)

Every contribution is split **exactly** into 6 buckets per the percentages in `config.buckets`. The total of allocations MUST equal the contribution amount down to the cent. The last bucket absorbs any rounding difference.

```ts
// src/lib/buckets.ts
const allocations = allocateToBuckets(100, buckets);
assertAllocationsSumExactly(100, allocations); // throws if mismatch
```

Tests: `tests/unit/buckets.test.ts`

### 2. Welfare caps (S2)

- Funeral: K8,000 max per event (first 24 months), 1/year in Y1-2, 2/year from Y3
- Medical: K3,000 max per event, 2/year max
- Capital buckets (Land, Business) **CANNOT** be used for welfare — no override
- Cap override requires a 2/3 note (logged)

```ts
// src/lib/claim-rules.ts
const check = checkWelfareClaim({
  type: 'FUNERAL',
  amountRequested: 9000,
  ...
});
if (!check.ok && !overrideNote) throw new Error(...);
```

### 3. Two-signature rule (S3)

Any welfare payout above K1,000 requires approval from BOTH the FW and the Chairperson. The service enforces this; the UI shows two checkboxes.

### 4. Audit log (S6)

Every state-changing action is logged via `logAudit()`. The log is **append-only** at the application layer (no delete handlers). For production, add a Postgres trigger to enforce at the DB layer.

```ts
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
await logAudit({
  userId: session.user.id,
  action: AUDIT_ACTIONS.CONTRIBUTION_RECORDED,
  entity: 'Contribution',
  entityId: contribution.id,
});
```

---

## Configuration

All cooperative parameters are in `src/lib/config.ts`. **Never hardcode** percentages, caps, member counts, or bucket names anywhere else.

```ts
// Adding a new member doesn't require a code change.
// The system computes monthly inflow from the active member count at runtime.
const totalKitty = await getActiveMemberCount() * config.monthlyContributionPerMember;
```

---

## Deployment

The simplest path:
- **Database:** Supabase (Postgres + Auth + Storage)
- **Hosting:** Vercel
- **Files:** Supabase Storage (`documents` bucket, private, signed URLs)
- **Email for password reset:** Supabase Auth (built-in; uses your project's SMTP / Resend config)

Set these env vars in your deploy platform:
- `DATABASE_URL` (transaction pooler)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to ship to browser)
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_APP_URL` (e.g. `https://members.biswic.coop`)

In the Supabase dashboard, under Authentication -> URL Configuration, add `https://members.biswic.coop/auth/callback` to the redirect allowlist.

---

## Testing

```bash
pnpm test           # Run all unit tests
pnpm test:watch     # Watch mode
```

Tests cover the two highest-risk areas:
- **Bucket allocation invariant** (S1) — exact sum, no rounding errors
- **Welfare claim cap enforcement** (S2 + S3) — caps, annual limits, two-sig

---

## What's NOT in Phase 1 (per the spec's "non-goals")

- Real mobile money / bank API integration (we record the method, don't transact)
- Real SMS sending (interface exists, stubbed)
- Real email sending (logged to console)
- Online voting / elections
- Document e-signatures
- Multi-currency
- Multi-cooperative

These are intentionally deferred to Phase 2+.

---

## Security checklist

- [x] Supabase Auth (bcrypt password hashing, JWT sessions, refresh tokens)
- [x] Account lockout after 5 failed attempts (30 min) — app layer + AuditLog
- [x] Append-only audit log (DB trigger in 0003, plus application layer)
- [x] Role-based access control (15 roles)
- [x] Server-side validation on all forms (Zod)
- [x] Prisma parameterized queries (no raw SQL)
- [x] HTTPS-only headers (configured in `next.config.js`)
- [x] No bank account details stored
- [x] Supabase service-role key never imported from src/app or src/components (enforced by `pnpm check:secrets`)
- [ ] 2FA enforcement for officers (interface ready, TOTP to be wired in a later phase)
- [ ] Rate limiting (add Vercel/Cloudflare rate limiting in production)

---

## License

Proprietary — for use by BISWIC and its members only.
