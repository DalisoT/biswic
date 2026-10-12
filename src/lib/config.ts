/**
 * BISWIC Platform Configuration
 * ----------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for all cooperative parameters.
 * Update values here to change platform-wide behavior.
 * DO NOT hardcode member counts, percentages, or caps anywhere else.
 */

export const config = {
  // Cooperative identity
  cooperativeName: 'Brothers in Service Welfare, Land & Investment Cooperative',
  cooperativeShortName: 'BISWIC',
  currency: 'K', // Local Kwacha
  currencyCode: 'ZMW', // ISO 4217
  country: 'Zambia',
  countryDialCode: '+260',
  language: 'en',
  timezone: 'Africa/Lusaka',

  // Member count is always read from the DB. The default seed count is for dev only.
  defaultSeedMemberCount: 50,

  // Financial model: per-member basis
  monthlyContributionPerMember: 100, // K100 per member per month

  // Bucket allocation percentages (must sum to 100)
  // Source of truth: Constitution Article 4.1 (as amended by GM vote, 2026-10-12)
  //   60% Land & Capital Reserve | 20% Business Seed | 15% Soft Loans |
  //    5% Admin & Audit
  // FUNERAL and MEDICAL were dropped at the same GM. The freed 18% was
  // rebalanced +10/+7/+1. BUSINESS is unchanged. The four active buckets
  // total 100%. Two closed buckets (FUNERAL, MEDICAL) are kept in the DB
  // with `isActive=false` for audit-trail integrity; new contributions and
  // new welfare claims do not flow through them.
  // At 74 members × K100/month: 4,440 + 1,480 + 1,110 + 370 = K7,400.
  buckets: {
    LAND_CAPITAL: {
      name: 'Land & Capital Reserve',
      code: 'LAND',
      percentage: 60,
    },
    BUSINESS_SEED: {
      name: 'Business Seed Fund',
      code: 'BUSINESS',
      percentage: 20,
    },
    SOFT_LOANS: {
      name: 'Soft Loans',
      code: 'SOFT_LOANS',
      percentage: 15,
    },
    ADMIN: {
      name: 'Admin & Audit',
      code: 'ADMIN',
      percentage: 5,
    },
  } as const,

  // Welfare payout caps (absolute amounts in K, NOT percentages)
  // ----------------------------------------------------------------------------
  // FUNERAL and MEDICAL welfare payouts were discontinued at the GM of
  // 2026-10-12 along with their respective buckets. The twoSignatureThreshold
  // (governance.twoSignatureThreshold) is retained for any future welfare pool
  // the GM may re-introduce. Claim submissions for FUNERAL/MEDICAL are
  // rejected by claim-rules.ts; the WelfareClaim table itself stays in the
  // schema so the audit history of pre-2026-10 payouts remains queryable.
  // welfareCaps is kept as a `disabled: true` block to make the deprecation
  // explicit without breaking any code that still imports the keys.
  welfareCaps: {
    funeral: {
      amountPerEvent: 0,
      maxPerYearYear1to2: 0,
      maxPerYearYear3plus: 0,
      initialCapPeriodMonths: 0,
      disabled: true,
    },
    medical: {
      amountPerEvent: 0,
      maxPerYear: 0,
      disabled: true,
    },
  },

  // Governance rules
  governance: {
    attendanceRequiredRatio: 0.75, // Must attend 75% of meetings (9 of 12 monthly)
    attendanceReviewRatio: 0.5, // Below 50% = flagged for review
    twoSignatureThreshold: 1000, // Welfare payouts > K1,000 need TWO signatures
    capOverrideRequiresNote: true, // 2/3 override note required if cap exceeded

    // Constitution Art. 2.2: "No additional members may be admitted before
    // the Cooperative's formal registration as a Cooperative under the laws
    // of [Country]."  Default: locked. Set the env var
    // FOUNDING_LOCK_RELEASED=true in Vercel to release the lock AFTER the
    // Cooperative has been formally registered. Until then, the in-app
    // "add member" flow rejects new admissions.
    foundingLockReleased: process.env.FOUNDING_LOCK_RELEASED === 'true',
  },

  // Land acquisition parameters
  totalProjectedLandAcquisitionHectares: { min: 1, max: 2 },
  totalProjectedLandPlotsPerHectare: 45, // ~450 sqm per plot

  // Soft Loans (Constitution Art. 5.5)
  softLoans: {
    maxPrincipal: 3000,            // K3,000 per member at any one time (Art. 5.5(c)(i))
    maxTermMonths: 6,              // 6-month max term (Art. 5.5(c)(ii))
    interestRatePerAnnum: 0.05,    // 5% p.a. (Art. 5.5(c)(iii))
    minMembershipMonths: 6,        // eligibility: 6+ months (Art. 5.5(b)(i))
    defaultAfterMissedPayments: 2, // 2 missed = default (Art. 5.5(f))
    requiredApprovals: 2,          // 2 of 3 sub-committee (Art. 5.5(d))
  },

  // Security
  security: {
    maxFailedLoginAttempts: 5,
    lockoutMinutes: 30,
    officerSessionTimeoutMinutes: 30,
    memberSessionTimeoutHours: 8,
    rateLimitAuthPer15Min: 5,
  },
  // Access control: gate login on payment status.
  // When true, members (role=MEMBER) must have at least one contribution
  // record on file to sign in. Officers (any other role) bypass the check
  // because they need access to record payments, approve claims, and
  // override edge cases.
  //
  // Toggle at runtime with the env var BISWIC_REQUIRE_PAYMENT_TO_LOGIN
  // (default true). Flip to 'false' to disable without redeploying.
  requirePaymentToLogin:
    (process.env.BISWIC_REQUIRE_PAYMENT_TO_LOGIN ?? 'true').toLowerCase() !==
    'false',
  // Lockout defaults. S6 baseline: 5 attempts, 30 min lockout.
  // Override with env vars during a rollout (e.g. WhatsApp-onboarding)
  // if a temporary relaxation is needed:
  //   BISWIC_LOGIN_MAX_ATTEMPTS    (default 5)
  //   BISWIC_LOGIN_LOCKOUT_MINUTES (default 30)
  loginMaxAttempts: Number.parseInt(
    process.env.BISWIC_LOGIN_MAX_ATTEMPTS ?? '5',
    10,
  ),
  loginLockoutMinutes: Number.parseInt(
    process.env.BISWIC_LOGIN_LOCKOUT_MINUTES ?? '30',
    10,
  ),

  // Cooperative start date (used for the 24-month funeral cap)
  // Set this to the actual launch date in production.
  cooperativeStartDate: new Date('2025-01-01'),
} as const;

export type BucketCode = (typeof config.buckets)[keyof typeof config.buckets]['code'];

/**
 * Helper: is the founding lock still active? (Constitution Art. 2.2)
 * Returns true while the cooperative has not been formally registered.
 */
export function isFoundingLockActive(now: Date = new Date()): boolean {
  return !config.governance.foundingLockReleased;
}

/**
 * Helper: get bucket by code
 */
export function getBucketByCode(code: string) {
  return Object.values(config.buckets).find((b) => b.code === code);
}

/**
 * Helper: get all bucket codes
 */
export function getAllBucketCodes(): BucketCode[] {
  return Object.values(config.buckets).map((b) => b.code);
}

/**
 * Helper: are we currently in the initial 24-month period?
 * During this period, the funeral cap is K8,000.
 */
export function isInInitialPeriod(now: Date = new Date()): boolean {
  const start = config.cooperativeStartDate;
  const monthsSinceStart =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return monthsSinceStart < config.welfareCaps.funeral.initialCapPeriodMonths;
}

/**
 * Helper: get the current annual funeral payout limit
 */
export function getFuncFalFuneralMaxPerYear(now: Date = new Date()): number {
  return isInInitialPeriod(now)
    ? config.welfareCaps.funeral.maxPerYearYear1to2
    : config.welfareCaps.funeral.maxPerYearYear3plus;
}
