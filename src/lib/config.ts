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
    MEDICAL: {
      name: 'Medical Emergency',
      code: 'MEDICAL',
      percentage: 8,
    },
    ADMIN: {
      name: 'Admin & Audit',
      code: 'ADMIN',
      percentage: 4,
    },
    EDUCATION: {
      name: 'Education Levy',
      code: 'EDUCATION',
      percentage: 3,
    },
  } as const,

  // Welfare payout caps (absolute amounts in K, NOT percentages)
  welfareCaps: {
    funeral: {
      amountPerEvent: 8000, // K8,000 max per funeral event
      maxPerYearYear1to2: 1, // 1 funeral payout/year in Years 1-2
      maxPerYearYear3plus: 2, // 2 funeral payouts/year from Year 3
      initialCapPeriodMonths: 24, // K8,000 cap applies for first 24 months
    },
    medical: {
      amountPerEvent: 3000, // K3,000 max per medical event
      maxPerYear: 2, // 2 medical payouts/year max
    },
  },

  // Governance rules
  governance: {
    attendanceRequiredRatio: 0.75, // Must attend 75% of meetings (9 of 12 monthly)
    attendanceReviewRatio: 0.5, // Below 50% = flagged for review
    twoSignatureThreshold: 1000, // Welfare payouts > K1,000 need TWO signatures
    capOverrideRequiresNote: true, // 2/3 override note required if cap exceeded
  },

  // Land acquisition parameters
  totalProjectedLandAcquisitionHectares: { min: 1, max: 2 },
  totalProjectedLandPlotsPerHectare: 45, // ~450 sqm per plot

  // Security
  security: {
    maxFailedLoginAttempts: 5,
    lockoutMinutes: 30,
    officerSessionTimeoutMinutes: 30,
    memberSessionTimeoutHours: 8,
    rateLimitAuthPer15Min: 5,
  },

  // Cooperative start date (used for the 24-month funeral cap)
  // Set this to the actual launch date in production.
  cooperativeStartDate: new Date('2025-01-01'),
} as const;

export type BucketCode = (typeof config.buckets)[keyof typeof config.buckets]['code'];

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
