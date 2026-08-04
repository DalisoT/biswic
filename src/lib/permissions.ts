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

export const APPROVE_WELFARE_ROLES: Role[] = [
  ROLES.WELFARE_OFFICER,
  ROLES.FW,
  ROLES.CHAIRPERSON,
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
export const POST_MEETING_MINUTES_ROLES: Role[] = [ROLES.SECRETARY];

/**
 * Role helpers
 */
export function isOfficer(role: Role | string): boolean {
  return OFFICER_ROLES.includes(role as Role);
}

export function canApproveWelfare(role: Role | string): boolean {
  return APPROVE_WELFARE_ROLES.includes(role as Role);
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
