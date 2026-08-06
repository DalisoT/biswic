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
  // Source of truth: Constitution Article 4.1
  //   50% Land & Capital Reserve | 20% Business Seed | 15% Funeral |
  //    8% Soft Loans           |  4% Admin & Audit  |  3% Medical Emergency
  // At 74 members × K100/month: 3,700 + 1,480 + 1,110 + 592 + 296 + 222 = K7,400.
  buckets: {
    LAND_CAPITAL: {
      name: 'Land & Capital Reserve',
      code: 'LAND',
      percentage: 50,
    },
    BUSINESS_SEED: {
      name: 'Business Seed Fund',
      code: 'BUSINESS',
      percentage: 20,
    },
    FUNERAL: {
      name: 'Funeral Support',
      code: 'FUNERAL',
      percentage: 15,
    },
    SOFT_LOANS: {
      name: 'Soft Loans',
      code: 'SOFT_LOANS',
      percentage: 8,
    },
    ADMIN: {
      name: 'Admin & Audit',
      code: 'ADMIN',
      percentage: 4,
    },
    MEDICAL: {
      name: 'Medical Emergency',
      code: 'MEDICAL',
      percentage: 3,
    },
  } as const,

  // Welfare payout caps (absolute amounts in K, NOT percentages)
  // Source of truth: Constitution Articles 5.1 (funeral) and 5.2 (medical).
  welfareCaps: {
    funeral: {
      amountPerEvent: 8000, // K8,000 max per funeral event
      maxPerYearYear1to2: 1, // 1 funeral payout/year in Years 1-2
      maxPerYearYear3plus: 2, // 2 funeral payouts/year from Year 3
      initialCapPeriodMonths: 24, // K8,000 cap applies for first 24 months
    },
    medical: {
      // Constitution Art. 5.2: K2,000 per event, 1 event/year.
      // (Reduced from the original K3,000 / 2 events/year when the Medical
      // bucket allocation was cut from 8% to 3% to fund Soft Loans.)
      // May be reviewed upward by 2/3 GM vote once the bucket has a
      // sustained balance.
      amountPerEvent: 2000,
      maxPerYear: 1,
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
  // Lockout tuning during the WhatsApp-onboarding rollout. Bumped from
  // the S6 baseline of 5 because 60+ members are signing in for the
  // first time and a few fat-fingered passwords shouldn't brick the
  // Treasurer's day. Override with env vars:
  //   BISWIC_LOGIN_MAX_ATTEMPTS  (default 10)
  //   BISWIC_LOGIN_LOCKOUT_MINUTES (default 15)
  loginMaxAttempts: Number.parseInt(
    process.env.BISWIC_LOGIN_MAX_ATTEMPTS ?? '10',
    10,
  ),
  loginLockoutMinutes: Number.parseInt(
    process.env.BISWIC_LOGIN_LOCKOUT_MINUTES ?? '15',
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
