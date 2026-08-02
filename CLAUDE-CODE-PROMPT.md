# Claude Code Prompt — BISWIC Member Platform (PWA)

> **How to use:** Copy everything from `---BEGIN PROMPT---` to `---END PROMPT---` below and paste it into Claude Code CLI as your first message. The prompt is self-contained — Claude will not need any additional context. You can iterate on individual features after the initial scaffold is built.

> **About the member count:** The Cooperative's current member count is dynamic and changes over time. The prompt does NOT hardcode any specific number. All financial calculations, projections, plot counts, and UI displays are computed at runtime from the database. The system must scale to 5, 50, 500, or 5,000 members without code changes.

---

## ---BEGIN PROMPT---

# Build a Progressive Web App (PWA) for BISWIC — a Military Welfare Cooperative

## 0. CONFIGURATION VARIABLES (SET THESE FIRST, THEN USE THROUGHOUT)

Before building anything, define these variables. They will be used throughout the entire platform. Put them in `src/lib/config.ts` so they can be updated in one place.

```typescript
// src/lib/config.ts
export const config = {
  // Cooperative identity
  cooperativeName: "Brothers in Service Welfare, Land & Investment Cooperative",
  cooperativeShortName: "BISWIC",
  currency: "K",  // Local Kwacha
  currencyCode: "ZMW",  // ISO 4217 (change to MWK, etc. for your country)
  country: "Zambia",  // Or your country
  countryDialCode: "+260",  // Or your country code
  language: "en",
  timezone: "Africa/Lusaka",  // Or your timezone

  // Member count — DO NOT hardcode anywhere. Always read from the database.
  // The system must scale to ANY number of members.
  defaultSeedMemberCount: 50,  // For development seed only

  // Financial model (per-member basis — multiply by active member count to get total)
  monthlyContributionPerMember: 100,  // K100 per member per month

  // Bucket allocation percentages (must sum to 100)
  buckets: {
    LAND_CAPITAL: { name: "Land & Capital Reserve", code: "LAND", percentage: 50 },
    BUSINESS_SEED: { name: "Business Seed Fund", code: "BUSINESS", percentage: 20 },
    FUNERAL: { name: "Funeral Support", code: "FUNERAL", percentage: 15 },
    MEDICAL: { name: "Medical Emergency", code: "MEDICAL", percentage: 8 },
    ADMIN: { name: "Admin & Audit", code: "ADMIN", percentage: 4 },
    EDUCATION: { name: "Education Levy", code: "EDUCATION", percentage: 3 },
  },

  // Welfare payout caps (in K, NOT in percentages — these are absolute amounts)
  // These are CONSTANTS regardless of how many members there are
  welfareCaps: {
    funeral: {
      amountPerEvent: 8000,           // K8,000 max per funeral event
      maxPerYearYear1to2: 1,          // 1 funeral payout/year in Years 1-2
      maxPerYearYear3plus: 2,         // 2 funeral payouts/year from Year 3
      initialCapPeriodMonths: 24,     // K8,000 cap applies for first 24 months
    },
    medical: {
      amountPerEvent: 3000,           // K3,000 max per medical event
      maxPerYear: 2,                  // 2 medical payouts/year max
    },
  },

  // Governance rules
  governance: {
    attendanceRequiredRatio: 0.75,    // Must attend 75% of meetings (9 of 12 monthly)
    attendanceReviewRatio: 0.50,      // Below 50% = flagged for review
    twoSignatureThreshold: 1000,      // Welfare payouts > K1,000 need TWO signatures
    capOverrideRequiresNote: true,    // 2/3 override note required if cap exceeded
  },

  // Land acquisition parameters
  totalProjectedLandAcquisitionHectares: { min: 1, max: 2 },
  totalProjectedLandPlotsPerHectare: 45,  // ~450 sqm per plot
};
```

**CRITICAL:** All bucket amounts, totals, projections, and member counts are computed dynamically using the variables above. NEVER hardcode the current member count anywhere in the code, the UI, or the database schema. The system must work for 5 members, 50 members, 500 members, or 5,000 members.

When you see `{N}` in this prompt, it means "current total active member count from the database" (computed at runtime).

**Examples of dynamic computation:**
- Total monthly inflow = `SELECT COUNT(*) FROM users WHERE role='MEMBER' AND isActive=true` × K100
- Bucket amount per contribution = `bucket.percentage / 100 × contribution.amount`
- "X of N paid this month" = `count(paid) / count(active_members)` — both from DB
- Land plot count = active members + community plot (1) + chair plot (0 or 1)
- 5-year projection = compute at runtime based on current member count

---

## 1. PROJECT CONTEXT

You are building a **Progressive Web App (PWA)** for the **Brothers in Service Welfare, Land & Investment Cooperative (BISWIC)** — a private welfare, savings, land-acquisition, and collective-investment society of **serving soldiers** in a Sub-Saharan African country (currency: K = local Kwacha). The current member count is `{N}` (dynamic) and can grow over time as new soldiers join.

**Mission:** Help serving soldiers pool monthly contributions, accumulate capital, buy land, run collective businesses, and provide capped welfare support to members and their families.

**Core strategic principle — "Build the Pot First, Payout Later":** The Cooperative deliberately prioritizes capital accumulation. Welfare payouts are capped so the majority of contributions stay in reserves for land and business investment.

This is **NOT** a fintech startup, **NOT** a bank, **NOT** a charity. It is a private member-owned cooperative of soldiers. Keep the design sober, military-appropriate, and trustworthy. Avoid flashy consumer-app aesthetics. Think "officer's club ledger" meets modern banking app.

---

## 2. CORE FINANCIAL MODEL (NON-NEGOTIABLE — derived from the Constitution)

**Monthly contribution per member:** K100 (constant — does not scale with N)
**Total monthly inflow:** `active_member_count × 100` = computed dynamically
**Total annual inflow:** `12 × active_member_count × 100` = computed dynamically

**Every Kwacha is split into 6 buckets in this exact proportion on receipt:**

| Bucket | % | K/month per member | Purpose |
|---|---|---|---|
| Land & Capital Reserve | 50% | 50 | Primary growth fund |
| Business Seed Fund | 20% | 20 | Income-generating ventures |
| Funeral Support | 15% | 15 | Member/parent/spouse/child death (CAPPED — see below) |
| Medical Emergency | 8% | 8 | Hospital bills (CAPPED — see below) |
| Admin & Audit | 4% | 4 | Stationery, meetings, audit |
| Education Levy | 3% | 3 | Children's school needs |

**Total per member per month: K100** (50 + 20 + 15 + 8 + 4 + 3 = 100, sums to 100%)

**Group totals are computed at runtime from the database:**
- `totalMonthlyInflow = (count of active members) × K100`
- `bucketMonthlyTotal = (count of active members) × K100 × (bucket.percentage / 100)`
- `bucketAnnualTotal = bucketMonthlyTotal × 12`

**UI display rule:** Always show group totals with the formula visible (e.g. "K6,700 (67 × K100)") so members understand the math. When the member count changes, totals update automatically.

**Welfare payout caps (encoded in the platform):**
- Funeral payout: **capped at K8,000 per event** for the first 24 months
- Maximum 1 funeral payout per year in Years 1–2, 2 per year from Year 3
- Medical payout: **capped at K3,000 per event**, max 2 per year
- A single event cannot draw from multiple buckets ("no double-dipping")
- If a welfare bucket runs dry in a year, no further payouts that year — surplus stays in capital
- Capital buckets (Land, Business) **CANNOT** be used for welfare payouts under any circumstances
- The Treasurer or Deputy Treasurer must record any welfare claim with: member ID, event type, death/burial certificate number (for funeral) or hospital admission letter (for medical), amount, date approved, two signatures

---

## 3. ROLES & PERMISSIONS (10 distinct roles — encoded as role-based access control)

### Main Committee (10 elected officers)
1. **Chairperson** — runs meetings, signs off on welfare payouts, external spokesperson, custodian of membership register
2. **Vice-Chairperson** — deputizes Chair, oversees welfare portfolio
3. **Chair of Capital Development (CCD)** — owns land + business agenda; chairs LSC and Business Sub-Committee; bank co-signatory for land/business
4. **Finance Warrant (FW)** — owns finance function; chairs Finance Sub-Committee; bank co-signatory for all transactions; presents budget + monthly statements; audit liaison
5. **Secretary** — minutes, correspondence, monthly statements
6. **Treasurer** — operational bookkeeping, daily cash management, payment processing; reports to FW
7. **Deputy Treasurer** — assistant bookkeeper, contributions register, receipts & vouchers; deputizes Treasurer
8. **Trustee 1, 2, 3** — oversight, conflict resolution, co-sign bank withdrawals

### Standard Member
- Sees only their own data (contributions, claims, statements) + aggregate group data (kitty total, bucket totals, recent activity feed, meeting dates, documents)

### Sub-Committee Members
- LSC members (3) — see land pipeline data
- Business Sub-Committee members (5) — see business performance data
- Finance Sub-Committee members (3) — see detailed financial data, audit logs
- Welfare Claims Officer (optional) — sees pending claims queue
- Internal Auditor (optional) — sees audit log + all transactions read-only
- IT/Comms Lead (optional) — manages announcements, member notifications

### Permission matrix:
| Action | Member | Treasurer | Deputy Treasurer | FW | CCD | Chair | Secretary | Trustee |
|---|---|---|---|---|---|---|---|---|
| View own data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all members | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View aggregate group data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Record own contribution | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Record any contribution | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submit welfare claim | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve welfare claim | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Transfer between buckets | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ (jointly with FW) | ❌ | ❌ |
| View audit log | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Edit any transaction | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (immutable) |
| Post meeting minutes | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Add new member | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Manage land pipeline | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage businesses | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage events/charity | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

---

## 4. REQUIRED FEATURES (Phase 1 — build these completely)

### F1. Authentication
- Login by **service number** (military ID, primary key) + password
- 2FA via SMS or TOTP for Treasurer, Deputy Treasurer, FW, CCD, Chair, Secretary (NOT for ordinary members)
- Password reset via service number + registered phone
- Session timeout: 30 minutes idle for officers, 8 hours for members
- **Lockout after 5 failed attempts** for 30 minutes
- All login events logged to audit log

### F2. Member Dashboard (every role sees this, but content varies)
- **Top bar:** Cooperative logo (use placeholder), member's name + service number, role badge, notification bell, logout
- **Hero card:** "My total contributions to date" + "My welfare claims history" + "My plot status" (if land is acquired)
- **Quick actions:** Submit claim, view statement, download receipt, contact committee
- **Group pulse:** Total kitty, this month's collection progress (X of {N} paid — both numbers from DB), recent activity feed (last 5 transactions — anonymized as "Member #23 paid K100"), next meeting date
- **Bucket breakdown** (visual): horizontal stacked bar showing the 6 buckets and their current balances
- **My contributions timeline** (last 12 months): table or bar chart

### F3. Group Dashboard (visible to all)
- **Total kitty** — large number, with delta vs. last month
- **Bucket balances** — 6 cards, one per bucket
- **Member count** — paid this month / total
- **Welfare claims YTD** — number and amount
- **Recent activity feed** — last 20 transactions, anonymized
- **Upcoming events** — next 3 meetings, events, deadlines
- **Quick links** — Constitution, meeting minutes, key documents

### F4. Member Contributions Module
- **Members register** (FW + Treasurer view): all active members (count from DB), their monthly contribution status, arrears
- **Add contribution** (Treasurer/Deputy Treasurer only): pick member, enter amount (default K100), date received, receipt number, payment method (payroll deduction / cash / mobile money / bank transfer), auto-allocate to the 6 buckets
- **Bulk contribution entry** (Treasurer): if payroll sends one bulk remittance, paste a CSV/Excel of (service_number, amount_paid) and the system updates all matching member rows at once (regardless of how many members there are)
- **Member contribution history** (own + officers): date, amount, receipt #, status
- **Arrears tracker** (FW + Treasurer): who hasn't paid, by how much, by when

### F5. Welfare Claims Module
- **Submit claim** (any member): event type (funeral/medical), beneficiary (self/parent/spouse/child), date of event, amount requested, upload supporting document (death cert / hospital letter)
- **Claims queue** (FW + Chair + Welfare Officer): pending / approved / rejected / paid
- **Approve/reject claim** (FW or Chair only): one-click approve with auto-deduction from the right welfare bucket; reject requires a reason
- **Two-signature rule** (encoded): for any welfare payout above K1,000, require explicit approval from BOTH the Chair and the FW (UI shows two checkboxes)
- **Cap enforcement:** if approving this claim would exceed the bucket's remaining annual budget (after subtracting already-approved claims), show a warning and require a 2/3 override note

### F6. Meetings Module
- **Schedule meeting** (Secretary + Chair): date, time, venue, agenda, expected attendees
- **Meeting list** (all): upcoming and past meetings
- **Attendance** (Secretary): mark attendees; non-attendance rule is "must attend 9 of 12 per year" — track and warn
- **Minutes** (Secretary): upload minutes PDF OR type rich-text; attach to meeting
- **Action items** (Secretary): list of to-dos from the meeting, with owner and due date; visible to all members

### F7. Documents Module
- **Document library:** Constitution, meeting minutes, audit reports, land deeds (when acquired), business contracts, annual reports
- **Upload** (Chair, Secretary, FW, CCD): PDF/Word/Excel/Image
- **Access control:** some docs are member-visible, some officer-only, some restricted to specific roles
- **Version history:** track who uploaded what, when
- **Search & filter**

### F8. Notifications
- **In-app notifications:** bell icon shows count, click to expand
- **Triggers:**
  - New meeting scheduled
  - New claim submitted (to FW + Chair)
  - Claim approved/rejected (to claimant)
  - Monthly statement ready (auto on the 10th of each month)
  - Arrears reminder (to member on the 5th if not paid)
  - Bucket low-balance warning (to FW)
  - Welfare cap reached (to FW + Chair)
- **SMS notifications** (Phase 1.5): use Africa's Talking or Twilio API — interface must be ready but the actual SMS sending can be a no-op stub
- **WhatsApp share** (Phase 1.5): generate a pre-filled WhatsApp message with key info, member clicks to send

### F9. Audit Log
- **Every action that mutates data** must be logged: who, what, when, before-value, after-value
- **Viewable** by FW, Chair, Trustees only
- **Filterable** by user, action type, date range
- **Immutable** — no one can edit or delete audit log entries (use append-only DB design)
- **Exportable** as CSV (for external auditor)

### F10. Reports
- **Monthly financial statement** (auto-generated on the 10th): PDF, includes opening balance, contributions, payouts, interest, closing balance per bucket
- **Personal statement** (member view, downloadable PDF): their contributions YTD, their claims YTD, their plot status
- **Annual report** (FW generates at year-end): all of the above + bucket performance + member growth + recommendations
- **Bucket analysis** (FW + CCD): trend over time, projected runway, recommendations
- **Arrears report** (FW + Treasurer): who owes what, by how many months
- **Member roster** (Secretary + Chair): printable, includes all active members with contact info and roles; supports pagination and search

### F11. Land Pipeline (CCD module)
- **Land opportunities** (LSC adds): location, size, asking price, photos, GPS coordinates, valuation report PDF, due-diligence checklist
- **Status tracker:** scouted → shortlist → due diligence → recommended → approved → purchased → subdivided → allotted
- **Plot allocation** (post-purchase): which member got which plot, transfer history
- **Land Register:** the official Capital Register the CCD must maintain

### F12. Business Module (CCD module)
- **Businesses list:** name, type, start date, capital invested, current monthly profit
- **Business detail:** income, expenses, profit/loss, employees, daily/weekly cash flow
- **Profit distribution:** calculate 60/30/10 split (reinvest / dividend / reserve), generate dividend statements per member
- **Decision log:** major decisions (new investment, expansion, closure) with date, decider, rationale

### F13. Events & Charity Module
- **Event calendar:** upcoming events (meetings, social events, AGM, family day, sports day, community events)
- **Charity projects:** list of charity projects with status, budget, target, beneficiaries, photos
- **Event registration:** members RSVP for events, see who's attending
- **Event reports:** post-event writeup, photos, attendance count

### F14. Settings & Profile
- **My profile:** name, service number, phone, email, next-of-kin, password change
- **Notification preferences:** which notifications to receive (in-app, SMS, email, WhatsApp)
- **Language:** English (default); structure code to support additional languages later
- **Theme:** Light (default), Dark mode

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### N1. Performance
- **First contentful paint** < 1.5 seconds on 3G
- **Time to interactive** < 3 seconds on 3G
- **Bundle size** < 500 KB initial JS, lazy-load the rest
- **Lighthouse score** > 90 (Performance, Accessibility, Best Practices, SEO)

### N2. Offline support
- Members can view their own dashboard, the constitution, meeting minutes, and the document library **offline**
- Any action taken offline (claim submission) is queued and synced when online
- Service Worker for caching assets
- IndexedDB for offline data

### N3. Mobile-first
- Designed for **Android phones from 2018+** (Tecno, Infinix, Samsung A-series, etc.) — 4GB RAM, 720p screens
- **Touch targets** minimum 44×44 px
- **No horizontal scroll** on any screen
- **Camera access** for uploading receipt photos
- **SMS reading permission** to auto-fill OTP
- **WhatsApp share intent** integration

### N4. Security
- **HTTPS only** — no HTTP fallback
- **Content Security Policy** strict
- **Input validation** on every form (server-side AND client-side)
- **SQL injection prevention** — use parameterized queries only
- **XSS prevention** — escape all user input, use a sanitization library
- **CSRF protection** on all state-changing requests
- **Rate limiting** on auth endpoints (5 attempts per 15 min)
- **Audit log** of all data mutations (see F9)
- **No PII in URLs**
- **Password storage:** bcrypt or argon2, never plaintext
- **JWT or session-based auth** with short expiry + refresh tokens
- **Bank account details NEVER stored in the platform** — they live in the Treasurer's offline records

### N5. Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation works for everything
- Screen reader compatible
- Color contrast 4.5:1 minimum
- Form labels associated with inputs
- Error messages announced
- Focus management

### N6. Internationalization-ready
- All user-facing strings in `i18n/en.json` (and structure code to easily add other languages)
- Date formatting per locale
- Currency formatting per locale (K with 2 decimal places, thousand separators)

---

## 6. TECH STACK (USE EXACTLY THIS)

### Frontend
- **Framework:** Next.js 14+ (App Router) with TypeScript
- **UI library:** Tailwind CSS + shadcn/ui (Radix primitives — accessible by default)
- **Forms:** react-hook-form + zod
- **Tables:** TanStack Table v8
- **Charts:** Recharts (for the dashboards)
- **Icons:** lucide-react
- **State management:** Zustand for client state, TanStack Query for server state
- **PWA:** next-pwa or Serwist (Service Worker, manifest, offline)
- **PDF generation:** react-pdf (for statements and reports)
- **Date handling:** date-fns
- **Auth client:** NextAuth.js v5 (Auth.js) with credentials provider

### Backend
- **Runtime:** Node.js 20+ LTS
- **API framework:** Next.js API routes (App Router route handlers) + tRPC for type-safe APIs
- **Database:** PostgreSQL 16+ (use Prisma ORM)
- **Auth server:** NextAuth.js v5 + database sessions (not JWT — easier to revoke)
- **File storage:** S3-compatible (Cloudflare R2, AWS S3, or MinIO for self-hosting) — abstracted behind a `StorageProvider` interface
- **Email:** Resend or SendGrid (transactional)
- **SMS:** Africa's Talking or Twilio (interface ready, actual sending can be a no-op stub for now)
- **Validation:** zod (shared between client and server)
- **Logging:** pino (structured JSON logs)
- **Background jobs:** BullMQ + Redis (for monthly statement generation, etc.)
- **Testing:** Vitest (unit) + Playwright (E2E)

### Infrastructure
- **Hosting:** Self-host on a cheap VPS (Hetzner, DigitalOcean, Linode) OR use Vercel for the frontend + Railway/Render for the DB
- **Database hosting:** managed PostgreSQL (Supabase, Neon, or Railway) — **NOT** SQLite in production
- **Backups:** daily automated DB backups, 30-day retention
- **Monitoring:** Sentry for errors, Plausible or Umami for analytics (privacy-friendly)
- **CI/CD:** GitHub Actions
- **Domain:** something like `members.biswic.coop` or `app.biswic.org`

### Cost estimate (low end, self-host)
- VPS: $5–20/month
- DB: $0–15/month (free tier on Neon/Supabase)
- Email: $0–10/month
- SMS: pay-per-use, ~$0.05/SMS
- Domain: $10–15/year
- **Total: $10–50/month** (K200–K1,000/month at current rates) — affordable

---

## 7. FILE STRUCTURE (USE THIS LAYOUT)

```
biswic-platform/
├── README.md
├── package.json
├── pnpm-lock.yaml (use pnpm)
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── .env.local (gitignored)
├── .gitignore
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── manifest.json
│   ├── icons/ (PWA icons in all sizes)
│   ├── sw.js
│   └── images/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (landing / login)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (member)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── contributions/page.tsx
│   │   │   ├── claims/
│   │   │   │   ├── page.tsx (list)
│   │   │   │   ├── new/page.tsx (submit)
│   │   │   │   └── [id]/page.tsx (detail)
│   │   │   ├── meetings/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── statement/page.tsx
│   │   ├── (officer)/
│   │   │   ├── fw/ (Finance Warrant routes)
│   │   │   │   ├── page.tsx (FW dashboard)
│   │   │   │   ├── statements/page.tsx
│   │   │   │   ├── audit-log/page.tsx
│   │   │   │   └── reports/page.tsx
│   │   │   ├── ccd/ (Capital Development routes)
│   │   │   │   ├── page.tsx (CCD dashboard)
│   │   │   │   ├── land/page.tsx
│   │   │   │   ├── businesses/page.tsx
│   │   │   │   └── capital-plan/page.tsx
│   │   │   ├── chair/ (Chairperson routes)
│   │   │   ├── secretary/ (Secretary routes)
│   │   │   └── treasurer/ (Treasurer + Deputy Treasurer routes)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── trpc/[trpc]/route.ts
│   │       └── webhooks/
│   ├── components/
│   │   ├── ui/ (shadcn/ui components)
│   │   ├── dashboard/
│   │   ├── contributions/
│   │   ├── claims/
│   │   ├── meetings/
│   │   ├── documents/
│   │   ├── audit-log/
│   │   ├── reports/
│   │   ├── land/
│   │   ├── businesses/
│   │   └── shared/ (header, sidebar, footer, etc.)
│   ├── lib/
│   │   ├── auth.ts (NextAuth config)
│   │   ├── db.ts (Prisma client)
│   │   ├── trpc.ts (tRPC setup)
│   │   ├── permissions.ts (RBAC helpers)
│   │   ├── buckets.ts (bucket allocation logic)
│   │   ├── audit.ts (audit log helpers)
│   │   ├── pdf.ts (PDF generation)
│   │   ├── sms.ts (SMS interface, stub)
│   │   ├── email.ts (email interface)
│   │   ├── storage.ts (file storage interface)
│   │   └── utils.ts
│   ├── server/
│   │   ├── routers/ (tRPC routers)
│   │   │   ├── members.ts
│   │   │   ├── contributions.ts
│   │   │   ├── claims.ts
│   │   │   ├── meetings.ts
│   │   │   ├── documents.ts
│   │   │   ├── audit.ts
│   │   │   ├── reports.ts
│   │   │   ├── land.ts
│   │   │   └── businesses.ts
│   │   └── services/
│   │       ├── bucket-service.ts
│   │       ├── claim-service.ts
│   │       └── statement-service.ts
│   ├── hooks/
│   ├── i18n/
│   │   └── en.json
│   ├── types/
│   └── styles/
│       └── globals.css
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    └── USER-GUIDE.md
```

---

## 8. DATABASE SCHEMA (Prisma)

Generate a Prisma schema with these models (and any others needed):

```prisma
// User
model User {
  id              String   @id @default(cuid())
  serviceNumber   String   @unique
  fullName        String
  rank            String?
  unit            String?
  phone           String   @unique
  email           String?  @unique
  passwordHash    String
  role            Role     @default(MEMBER)
  nextOfKin       Json?    // { name, relationship, phone }
  isActive        Boolean  @default(true)
  joinedAt        DateTime @default(now())
  leftAt          DateTime?
  // 2FA
  twoFactorSecret String?
  twoFactorEnabled Boolean @default(false)
  // Relations
  contributions   Contribution[]
  claims          WelfareClaim[]
  auditLogs       AuditLog[]
  uploadedDocs    Document[]
  // ... etc
}

enum Role {
  MEMBER
  CHAIRPERSON
  VICE_CHAIRPERSON
  CCD
  FW
  SECRETARY
  TREASURER
  DEPUTY_TREASURER
  TRUSTEE
  LSC_MEMBER
  BUSINESS_MEMBER
  FINANCE_MEMBER
  WELFARE_OFFICER
  INTERNAL_AUDITOR
  IT_COMMS_LEAD
}

// Bucket
model Bucket {
  id          String   @id @default(cuid())
  name        String   @unique // "Land & Capital Reserve", "Business Seed Fund", etc.
  code        String   @unique // "LAND", "BUSINESS", "FUNERAL", "MEDICAL", "ADMIN", "EDUCATION"
  percentage  Decimal  // 0.50, 0.20, etc.
  balance     Decimal  @default(0)
  // Relations
  transactions Transaction[]
  claims       WelfareClaim[]
}

// Contribution
model Contribution {
  id            String   @id @default(cuid())
  memberId      String
  member        User     @relation(fields: [memberId], references: [id])
  amount        Decimal
  month         Int      // 1-12
  year          Int
  paymentMethod PaymentMethod
  receiptNumber String?  @unique
  receivedAt    DateTime
  recordedById  String
  recordedBy    User     @relation("RecordedContributions", fields: [recordedById], references: [id])
  // Bucket allocations (auto-computed on save)
  allocations   BucketAllocation[]
  // Audit
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([memberId, month, year])
}

enum PaymentMethod {
  PAYROLL_DEDUCTION
  CASH
  MOBILE_MONEY
  BANK_TRANSFER
}

model BucketAllocation {
  id              String   @id @default(cuid())
  contributionId  String
  contribution    Contribution @relation(fields: [contributionId], references: [id], onDelete: Cascade)
  bucketId        String
  bucket          Bucket   @relation(fields: [bucketId], references: [id])
  amount          Decimal
}

// WelfareClaim
model WelfareClaim {
  id              String   @id @default(cuid())
  memberId        String
  member          User     @relation(fields: [memberId], references: [id])
  type            ClaimType
  beneficiary     String   // "self" / "parent" / "spouse" / "child" / "father" / "mother"
  eventDate       DateTime
  amountRequested Decimal
  amountApproved  Decimal?
  bucketId        String?
  bucket          Bucket?  @relation(fields: [bucketId], references: [id])
  status          ClaimStatus @default(PENDING)
  supportingDocUrl String?
  // Two-signature approval
  approvedByFwId  String?
  approvedByFwAt  DateTime?
  approvedByChairId String?
  approvedByChairAt DateTime?
  // Override (if cap exceeded)
  capOverrideNote String?
  // Audit
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  rejectedReason  String?
  paidAt          DateTime?
}

enum ClaimType {
  FUNERAL
  MEDICAL
}

enum ClaimStatus {
  PENDING
  APPROVED
  REJECTED
  PAID
}

// Meeting
model Meeting {
  id          String   @id @default(cuid())
  title       String
  type        MeetingType
  scheduledAt DateTime
  venue       String
  agenda      String
  minutes     String?  // rich text or markdown
  minutesDocUrl String?
  status      MeetingStatus @default(SCHEDULED)
  // Relations
  attendees   MeetingAttendance[]
  actionItems ActionItem[]
  createdById String
  createdAt   DateTime @default(now())
}

enum MeetingType {
  MONTHLY
  QUARTERLY
  AGM
  SPECIAL
  EMERGENCY
}

enum MeetingStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model MeetingAttendance {
  id        String   @id @default(cuid())
  meetingId String
  meeting   Meeting  @relation(fields: [meetingId], references: [id])
  memberId  String
  member    User     @relation(fields: [memberId], references: [id])
  attended  Boolean  @default(false)
  @@unique([meetingId, memberId])
}

model ActionItem {
  id          String   @id @default(cuid())
  meetingId   String
  meeting     Meeting  @relation(fields: [meetingId], references: [id])
  description String
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  dueDate     DateTime?
  status      ActionItemStatus @default(OPEN)
  createdAt   DateTime @default(now())
}

enum ActionItemStatus {
  OPEN
  IN_PROGRESS
  DONE
  CANCELLED
}

// Document
model Document {
  id          String   @id @default(cuid())
  title       String
  description String?
  fileUrl     String
  fileType    String
  fileSize    Int
  category    DocumentCategory
  accessLevel DocumentAccess @default(MEMBER)
  uploadedById String
  uploadedBy  User     @relation(fields: [uploadedById], references: [id])
  version     Int      @default(1)
  // Relations
  versions    DocumentVersion[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum DocumentCategory {
  CONSTITUTION
  MEETING_MINUTES
  AUDIT_REPORT
  LAND_DEED
  BUSINESS_CONTRACT
  ANNUAL_REPORT
  POLICY
  OTHER
}

enum DocumentAccess {
  PUBLIC
  MEMBER
  OFFICER
  EXECUTIVE
  RESTRICTED
}

model DocumentVersion {
  id         String   @id @default(cuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id])
  version    Int
  fileUrl    String
  uploadedById String
  notes      String?
  createdAt  DateTime @default(now())
}

// Land
model LandOpportunity {
  id            String   @id @default(cuid())
  title         String
  location      String
  gpsCoords     String?
  sizeHectares  Decimal
  sizeSqm       Decimal
  askingPrice   Decimal
  valuationPrice Decimal?
  status        LandStatus @default(SCOUTED)
  photos        String[]
  documents     String[]
  dueDiligence  Json?    // checklist results
  notes         String?
  // Relations
  lscMembers    LandOpportunityMember[]
  addedById     String
  addedBy       User     @relation(fields: [addedById], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum LandStatus {
  SCOUTED
  SHORTLIST
  DUE_DILIGENCE
  RECOMMENDED
  APPROVED
  PURCHASED
  SUBDIVIDED
  REJECTED
}

model LandPurchase {
  id              String   @id @default(cuid())
  opportunityId   String   @unique
  opportunity     LandOpportunity @relation(fields: [opportunityId], references: [id])
  purchasePrice   Decimal
  purchaseDate    DateTime
  deedUrl         String?
  totalPlots      Int
  plotsAllocated  Int      @default(0)
  communityPlots  Int      @default(1)
}

model Plot {
  id           String   @id @default(cuid())
  purchaseId   String
  purchase     LandPurchase @relation(fields: [purchaseId], references: [id])
  plotNumber   Int
  memberId     String?
  member       User?    @relation(fields: [memberId], references: [id])
  allocatedAt  DateTime?
  status       PlotStatus @default(UNALLOCATED)
  notes        String?
}

enum PlotStatus {
  UNALLOCATED
  ALLOCATED
  TRANSFERRED
  REPOSSESSED
}

// Business
model Business {
  id              String   @id @default(cuid())
  name            String
  type            String   // "MOBILE_MONEY", "FUEL_STATION", etc.
  status          BusinessStatus @default(PLANNING)
  startDate       DateTime?
  capitalInvested Decimal   @default(0)
  currentMonthlyProfit Decimal @default(0)
  // Relations
  transactions    BusinessTransaction[]
  decisions       BusinessDecision[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum BusinessStatus {
  PLANNING
  ACTIVE
  PAUSED
  CLOSED
}

model BusinessTransaction {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  date        DateTime
  type        TransactionType
  amount      Decimal
  description String
  receiptUrl  String?
  recordedById String
}

enum TransactionType {
  INCOME
  EXPENSE
  CAPITAL_INJECTION
  PROFIT_DISTRIBUTION
}

model BusinessDecision {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  decision    String
  rationale   String
  decidedById String
  decidedAt   DateTime
}

// Events & Charity
model Event {
  id          String   @id @default(cuid())
  title       String
  description String
  type        EventType
  startAt     DateTime
  endAt       DateTime?
  venue       String
  isPublic    Boolean  @default(false)
  // Relations
  rsvps       EventRSVP[]
  photos      String[]
  report      String?
  createdAt   DateTime @default(now())
  createdById String
}

enum EventType {
  MEETING
  AGM
  FAMILY_DAY
  SPORTS_DAY
  COMMUNITY_EVENT
  CHARITY_DRIVE
  OTHER
}

model EventRSVP {
  id      String   @id @default(cuid())
  eventId String
  event   Event    @relation(fields: [eventId], references: [id])
  memberId String
  status  RSVPStatus @default(PENDING)
  @@unique([eventId, memberId])
}

enum RSVPStatus {
  PENDING
  YES
  NO
  MAYBE
}

model CharityProject {
  id          String   @id @default(cuid())
  name        String
  description String
  budget      Decimal
  spent       Decimal  @default(0)
  startDate   DateTime
  endDate     DateTime?
  status      CharityStatus @default(PLANNING)
  beneficiaries String?
  impact      String?
  photos      String[]
  createdAt   DateTime @default(now())
}

enum CharityStatus {
  PLANNING
  ACTIVE
  COMPLETED
  CANCELLED
}

// Audit Log (append-only)
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String   // "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "FAILED_LOGIN", etc.
  entity      String   // "Contribution", "WelfareClaim", etc.
  entityId    String?
  beforeValue Json?
  afterValue  Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([userId, createdAt])
  @@index([entity, entityId])
  @@index([action, createdAt])
}

// Notifications
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String
  title     String
  body      String
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, read, createdAt])
}
```

---

## 9. CRITICAL BUSINESS LOGIC (encode these as services)

### S1. Bucket allocation on contribution
```typescript
// When a contribution of K100 is received, automatically split into 6 buckets per the percentages
// LAND: K50, BUSINESS: K20, FUNERAL: K15, MEDICAL: K8, ADMIN: K4, EDUCATION: K3
// Use Decimal arithmetic (no floats) to avoid rounding errors
// Total of allocations MUST equal the contribution amount exactly
```

### S2. Welfare claim cap enforcement
```typescript
// Before approving a claim:
// 1. Check if it would exceed the bucket's annual cap (K8,000 funeral, K3,000 medical)
// 2. Check if the event type has hit its annual limit (1 funeral/yr in Y1-2, 2/yr from Y3; 2 medical/yr max)
// 3. Check the 24-month rule: funeral payout is K8,000 max for first 24 months of operation
// 4. If any cap is hit, BLOCK approval and require a 2/3 override note (with timestamp, FW signature, Chair signature)
// 5. Cap-overridden claims still need to be tracked separately for audit
```

### S3. Two-signature rule
```typescript
// Any welfare payout > K1,000 requires approval from BOTH the FW and the Chairperson
// The UI shows two checkboxes; only when both are checked does the claim move to APPROVED status
// The system records who approved and when, in the WelfareClaim record
```

### S4. No cross-bucket borrowing
```typescript
// When a claim is approved, deduct ONLY from the appropriate welfare bucket (FUNERAL or MEDICAL)
// DO NOT allow deduction from LAND, BUSINESS, ADMIN, or EDUCATION buckets
// This is a hard rule with no override
```

### S5. Surplus carry-forward
```typescript
// At the end of the financial year, calculate the unused balance in each bucket
// Carry it forward to the next year as the opening balance for that bucket
// Do NOT transfer surplus from one bucket to another
```

### S6. Audit log everything
```typescript
// Every state-changing action (CREATE, UPDATE, DELETE, LOGIN, FAILED_LOGIN, PAYOUT_APPROVED, etc.)
// must be logged with: who, what, when, before-value, after-value, IP, user agent
// The audit log is APPEND-ONLY — no one can edit or delete entries
// Use a Postgres trigger or Prisma middleware to enforce this
```

### S7. Member attendance rule
```typescript
// Per the Constitution: "Attend at least 9 out of 12 monthly meetings per year"
// Track each member's attendance
// If a member's YTD attendance drops below 75% of expected, show a warning
// At 50% or below, mark the member for review at the next General Meeting
```

### S8. Plot allocation (post-purchase)
```typescript
// Once a LandPurchase is recorded with N plots:
// - Create N Plot records where N = current active member count + 1 community plot (+ optionally 1 chair plot if the Constitution defines it)
// - All plots are stored with their plot number; community plot has memberId = null
// - All other plots are randomly allocated to active members via a draw (or alphabetical, or first-come-first-served — make this configurable)
// - The plot count is computed at runtime from `SELECT COUNT(*) FROM users WHERE role='MEMBER' AND isActive=true`, never hardcoded
// - Record the date and method of allocation
// - Lock the allocation after 30 days
```

---

## 10. SEED DATA (for development)

When running `pnpm prisma db seed`, create:

1. **6 Buckets** with the exact names, codes, and percentages from `config.buckets` (Section 0)
2. **10 Users** with the 10 main Committee roles, using predictable placeholder service numbers:
   - Chairperson: `CHAIR-001`
   - Vice-Chairperson: `VICE-001`
   - CCD: `CCD-001`
   - FW: `FW-001`
   - Secretary: `SEC-001`
   - Treasurer: `TR-001`
   - Deputy Treasurer: `DTR-001`
   - Trustee 1, 2, 3: `TRUSTEE-001`, `TRUSTEE-002`, `TRUSTEE-003`
   - Password for all officers: `ChangeMe123!`
3. **`config.defaultSeedMemberCount` Members** (default 50) with placeholder data:
   - Service numbers: `MEMBER-001` through `MEMBER-050`
   - All with role `MEMBER`
   - Password for all members: `ChangeMe123!`
4. **12 months of sample contributions** (Jan–Dec 2026) for all seeded members, all marked as paid
5. **2 sample welfare claims** — 1 funeral (approved, paid), 1 medical (pending)
6. **3 sample meetings** — 2 past (with minutes), 1 upcoming
7. **1 Constitution document** (placeholder PDF)
8. **1 sample land opportunity** (scouted, not yet purchased)
9. **0 businesses** (none yet — but the structure must support them)
10. **2 sample events** — 1 past (AGM), 1 upcoming (Family Day)
11. **1 sample charity project** (orphanage visit, completed)

**All seed numbers are derived from `config.defaultSeedMemberCount`, never hardcoded.**

---

## 11. UI/UX DESIGN GUIDELINES

### Visual style
- **Color palette:** Navy blue (#0a3a5c) primary, slate grey (#475569) secondary, muted gold (#b45309) for highlights, white background, dark text
- **Typography:** Inter for body, IBM Plex Sans for headings (or any modern sans-serif)
- **No emojis** as primary UI elements (they look unprofessional for a military cooperative)
- **Iconography:** lucide-react icons, used sparingly
- **Spacing:** generous padding, military-appropriate (not cramped)
- **Cards:** subtle shadow, rounded-lg, white background
- **Buttons:** primary navy, secondary white-with-border, danger red only for destructive actions
- **Status badges:** green (paid/active), amber (pending), red (rejected/overdue), grey (inactive)

### Layout
- **Sidebar navigation** (left, on desktop; bottom-bar on mobile) with role-based menu items
- **Top bar:** logo, page title, search, notifications, user menu
- **Main content area:** max-width 1280px, centered
- **Footer:** minimal — copyright, version, "BISWIC Member Platform v1.0"

### Tone
- Use **"we"** not "you" where appropriate
- Member-facing language: warm but not chatty
- Officer-facing language: clear, professional, no fluff
- Avoid jargon unless the audience is technical

### Specific UI patterns
- **Numbers:** always show with thousand separators (K6,700 not K6700)
- **Money:** show 2 decimal places (K100.00) in statements, no decimals in dashboards (K6,700)
- **Dates:** "22 July 2026" format (day-month-year), not "07/22/2026"
- **Phone numbers:** format with country code (+260 97 123 4567)
- **Status indicators:** use both color AND icon (don't rely on color alone — accessibility)
- **Empty states:** always show a helpful message + a call-to-action button
- **Errors:** show inline next to the field, not as alerts
- **Loading:** skeletons, not spinners (better perceived performance)

---

## 12. SECURITY CHECKLIST (verify all before delivery)

- [ ] All passwords hashed with bcrypt or argon2
- [ ] All forms have server-side validation (don't trust client)
- [ ] All SQL queries use Prisma parameterized queries (no raw SQL)
- [ ] All user input is sanitized before rendering (XSS prevention)
- [ ] CSRF tokens on all state-changing requests
- [ ] Rate limiting on auth endpoints (5/15min)
- [ ] Account lockout after 5 failed logins
- [ ] 2FA enforced for all officer roles
- [ ] Bank account details NEVER stored in the database
- [ ] Audit log is append-only (DB constraint)
- [ ] HTTPS only (HSTS enabled)
- [ ] CSP headers configured
- [ ] No secrets in client-side code
- [ ] No PII in URLs or logs
- [ ] Session timeout: 30min officer, 8hr member
- [ ] Right to be forgotten: when a member leaves, anonymize their data within 30 days

---

## 13. DELIVERABLES (what to ship in Phase 1)

By the end of Phase 1, deliver:

1. **Working PWA** that runs on `pnpm dev` and `pnpm build && pnpm start`
2. **Database schema** in `prisma/schema.prisma` with migrations
3. **Seed script** that creates the data in Section 10
4. **README.md** with:
   - Project overview
   - Tech stack
   - Local setup instructions (clone, install, env, migrate, seed, run)
   - Test instructions
   - Deployment overview
5. **All 14 features (F1–F14) implemented and working**
6. **All 8 business logic rules (S1–S8) implemented and tested**
7. **All security checklist items implemented**
8. **Accessibility audit** (Lighthouse score > 90)
9. **Basic unit tests** for the bucket allocation logic, claim cap enforcement, and 2-signature rule (these are the highest-risk areas)
10. **Demo data** for screenshots / user testing

---

## 14. WHAT TO BUILD FIRST (in this order)

1. **Scaffolding:** Initialize Next.js + TypeScript + Tailwind + shadcn/ui + Prisma + NextAuth.js
2. **Database:** Prisma schema + migrations + seed
3. **Auth:** Login, 2FA for officers, password reset
4. **Member dashboard** (the simplest version)
5. **Contributions module** (the most-used feature, tests bucket allocation)
6. **Welfare claims module** (the most-regulated feature, tests cap enforcement + 2-signature)
7. **Meetings module**
8. **Documents module**
9. **Audit log**
10. **Notifications**
11. **Reports**
12. **Land module** (CCD)
13. **Business module** (CCD)
14. **Events & Charity module**
15. **Polish:** accessibility, performance, mobile testing

---

## 15. NON-GOALS (do NOT build these in Phase 1)

- Mobile money / payment integration (just record the method, don't actually transact)
- Bank API integration (the Treasurer records manually)
- Real SMS sending (stub the interface, no actual sending)
- Real email sending (stub the interface, log to console for now)
- Online voting / elections
- Document e-signatures
- Advanced analytics / ML
- Multi-currency support
- Multi-cooperative support (one instance = one cooperative)
- Public landing page (only logged-in users see the app)

---

## 16. CODING CONVENTIONS

- **TypeScript strict mode** — no `any`
- **ESLint + Prettier** — no unformatted code
- **Conventional Commits** for git commits
- **Component naming:** PascalCase (`MemberDashboard.tsx`)
- **Hook naming:** camelCase with `use` prefix (`useMember.ts`)
- **Service naming:** camelCase with `Service` suffix (`bucketService.ts`)
- **Database queries:** always via tRPC, never direct from components
- **API responses:** always wrapped in `{ data: ..., error: ... }` or use tRPC's built-in error handling
- **Error messages:** user-friendly, no technical jargon in the UI; technical details in the logs only
- **Comments:** explain WHY, not WHAT
- **Tests:** one unit test per business logic function; one E2E test per critical user flow

---

## 17. CRITICAL REMINDERS

1. **This is a real cooperative with real money.** Every line of code affects real families. Test thoroughly.
2. **The bucket allocation is the most sacred rule.** It MUST be exact, no exceptions, no rounding errors.
3. **Welfare caps are the second most sacred rule.** They protect the cooperative from being drained.
4. **The audit log is the third most sacred rule.** It is the cooperative's defense against disputes and fraud.
5. **Security > features.** If you have to choose between a fancy feature and a security fix, choose security.
6. **Mobile > desktop.** Most members will access this from a phone.
7. **Offline support matters.** Internet in the area may be patchy.
8. **When in doubt, ask.** It's better to clarify a requirement than to build the wrong thing.

---

## 18. START NOW

Build the scaffolding. Set up the database. Get the auth working. Then iterate feature by feature in the order in Section 14. Use this prompt as your single source of truth. Don't invent requirements — if something isn't in this prompt, ask before building it.

Make the codebase production-quality, well-documented, and easy to hand off to another developer. Use modern best practices. Add meaningful tests. Comment generously.

Begin.

## ---END PROMPT---
