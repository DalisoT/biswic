/**
 * Permissions (RBAC) - Role-Based Access Control
 * ----------------------------------------------------------------------------
 * Encodes the permission matrix from the spec. All authorization checks
 * MUST go through these functions - never string-compare roles in components.
 */

export const ROLES = {
  MEMBER: 'MEMBER',
  CHAIRPERSON: 'CHAIRPERSON',
  VICE_CHAIRPERSON: 'VICE_CHAIRPERSON',
  CCD: 'CCD',
  FW: 'FW',
  SECRETARY: 'SECRETARY',
  TREASURER: 'TREASURER',
  DEPUTY_TREASURER: 'DEPUTY_TREASURER',
  TRUSTEE: 'TRUSTEE',
  LSC_MEMBER: 'LSC_MEMBER',
  BUSINESS_MEMBER: 'BUSINESS_MEMBER',
  FINANCE_MEMBER: 'FINANCE_MEMBER',
  WELFARE_OFFICER: 'WELFARE_OFFICER',
  INTERNAL_AUDITOR: 'INTERNAL_AUDITOR',
  IT_COMMS_LEAD: 'IT_COMMS_LEAD',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

export const OFFICER_ROLES: Role[] = [
  ROLES.CHAIRPERSON,
  ROLES.VICE_CHAIRPERSON,
  ROLES.CCD,
  ROLES.FW,
  ROLES.SECRETARY,
  ROLES.TREASURER,
  ROLES.DEPUTY_TREASURER,
  ROLES.TRUSTEE,
];


export const RECORD_CONTRIBUTION_ROLES: Role[] = [
  ROLES.TREASURER,
  ROLES.DEPUTY_TREASURER,
  ROLES.FW,
];

export const VIEW_ALL_MEMBERS_ROLES: Role[] = [
  ROLES.TREASURER,
  ROLES.DEPUTY_TREASURER,
  ROLES.FW,
  ROLES.CCD,
  ROLES.CHAIRPERSON,
  ROLES.SECRETARY,
  ROLES.TRUSTEE,
];

export const VIEW_AUDIT_LOG_ROLES: Role[] = [
  ROLES.FW,
  ROLES.CHAIRPERSON,
  ROLES.TRUSTEE,
  ROLES.INTERNAL_AUDITOR,
];

export const MANAGE_LAND_ROLES: Role[] = [ROLES.CCD, ROLES.LSC_MEMBER];
export const MANAGE_BUSINESS_ROLES: Role[] = [ROLES.CCD, ROLES.BUSINESS_MEMBER];
export const MANAGE_EVENTS_ROLES: Role[] = [ROLES.CHAIRPERSON, ROLES.SECRETARY, ROLES.IT_COMMS_LEAD];
export const MANAGE_DOCUMENTS_ROLES: Role[] = [ROLES.CHAIRPERSON, ROLES.SECRETARY, ROLES.FW, ROLES.CCD];
export const ADD_MEMBERS_ROLES: Role[] = [ROLES.CHAIRPERSON, ROLES.SECRETARY];

/**
 * Who may see the bucket reconciliation -- the live balance of each bucket
 * against the running BucketTransaction ledger, with the drift.
 *
 * This is an internal accounting view. It answers "did every balance change
 * go through the ledger", which is a question for the committee closing the
 * month, not something a member needs on their dashboard. Plain members see
 * the kitty allocation and nothing about drift or ledger entry counts.
 */
export const VIEW_RECONCILIATION_ROLES: Role[] = [
  ...OFFICER_ROLES,
  ROLES.INTERNAL_AUDITOR,
];
export const POST_MEETING_MINUTES_ROLES: Role[] = [ROLES.SECRETARY];

/**
 * Role helpers
 */
export function isOfficer(role: Role | string): boolean {
  return OFFICER_ROLES.includes(role as Role);
}


export function canRecordContributions(role: Role | string): boolean {
  return RECORD_CONTRIBUTION_ROLES.includes(role as Role);
}

export function canViewAllMembers(role: Role | string): boolean {
  return VIEW_ALL_MEMBERS_ROLES.includes(role as Role);
}

export function canViewAuditLog(role: Role | string): boolean {
  return VIEW_AUDIT_LOG_ROLES.includes(role as Role);
}

/**
 * Whether a role may see the bucket reconciliation card.
 * See VIEW_RECONCILIATION_ROLES for why it is restricted.
 */
export function canViewReconciliation(role: Role | string): boolean {
  return VIEW_RECONCILIATION_ROLES.includes(role as Role);
}

export function canManageLand(role: Role | string): boolean {
  return MANAGE_LAND_ROLES.includes(role as Role);
}

export function canManageBusiness(role: Role | string): boolean {
  return MANAGE_BUSINESS_ROLES.includes(role as Role);
}

export function canManageEvents(role: Role | string): boolean {
  return MANAGE_EVENTS_ROLES.includes(role as Role);
}

export function canManageDocuments(role: Role | string): boolean {
  return MANAGE_DOCUMENTS_ROLES.includes(role as Role);
}

export function canManageMembers(role: Role | string): boolean {
  return ADD_MEMBERS_ROLES.includes(role as Role);
}

/**
 * Global admin override. Accepts either an AuthUser-like object (which
 * carries an isAdmin boolean) or a plain role string. When isAdmin=true
 * is present, every role check should be treated as passing. The visible
 * role label is left untouched so the UI continues to show the user as
 * their elected position (e.g. CCD, SECRETARY).
 */
export function hasAdminAccess(
  userOrRole: { isAdmin?: boolean } | Role | string,
): boolean {
  if (typeof userOrRole === 'object' && userOrRole !== null) {
    return userOrRole.isAdmin === true;
  }
  return false;
}

/**
 * Role check that also honours the global admin override.
 *
 * Use this instead of `canX(user.role)` inside server actions so the
 * override is applied consistently. The plain `canX(role)` helpers read the
 * role string only and would ignore a user whose `isAdmin` is true.
 *
 * The Chairman/admin (service 106759) is the platform owner and is expected
 * to be able to record contributions and manage the register; before this
 * helper existed the override was applied in some actions and silently
 * missing in others, which meant the owner could be locked out of exactly
 * the screens they need most.
 */
export function canActAs(
  user: { role: string; isAdmin?: boolean },
  roleCheck: (role: string) => boolean,
): boolean {
  return hasAdminAccess(user) || roleCheck(user.role);
}

/**
 * Same idea as `canActAs`, for screens that gate on an explicit list of roles
 * rather than one of the named permission helpers (e.g. `allowedRoles` arrays
 * in the land, businesses and reports pages).
 *
 * Use this instead of `allowedRoles.includes(user.role)`.
 */
export function canActAsAnyRole(
  user: { role: string; isAdmin?: boolean },
  allowedRoles: readonly string[],
): boolean {
  return hasAdminAccess(user) || allowedRoles.includes(user.role);
}

export function canPostMinutes(role: Role | string): boolean {
  return POST_MEETING_MINUTES_ROLES.includes(role as Role);
}

export function requiresTwoFactor(role: Role | string): boolean {
  return isOfficer(role);
}

export function roleLabel(role: Role | string): string {
  const labels: Record<string, string> = {
    MEMBER: 'Member',
    CHAIRPERSON: 'Chairperson',
    VICE_CHAIRPERSON: 'Vice-Chairperson',
    CCD: 'Chair of Capital Development',
    FW: 'Finance Warrant',
    SECRETARY: 'Secretary',
    TREASURER: 'Treasurer',
    DEPUTY_TREASURER: 'Deputy Treasurer',
    TRUSTEE: 'Trustee',
    LSC_MEMBER: 'LSC Member',
    BUSINESS_MEMBER: 'Business Sub-Committee',
    FINANCE_MEMBER: 'Finance Sub-Committee',
    WELFARE_OFFICER: 'Welfare Claims Officer',
    INTERNAL_AUDITOR: 'Internal Auditor',
    IT_COMMS_LEAD: 'IT / Comms Lead',
  };
  return labels[role] ?? role;
}
