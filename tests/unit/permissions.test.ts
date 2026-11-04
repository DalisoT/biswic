/**
 * Unit tests for the role/permission helpers.
 *
 * The important behaviour here is the global admin override: `isAdmin` is
 * documented as bypassing every role check while leaving the visible role
 * label untouched. Before `canActAs` existed, some server actions applied
 * that override and others silently ignored it, which locked the platform
 * owner out of exactly the financial screens they need most.
 */

import { describe, it, expect } from 'vitest';
import {
  canActAs,
  canActAsAnyRole,
  hasAdminAccess,
  canRecordContributions,
  canViewAllMembers,
  canManageMembers,
} from '../../src/lib/permissions';

describe('hasAdminAccess', () => {
  it('is true for a user object with isAdmin true', () => {
    expect(hasAdminAccess({ isAdmin: true })).toBe(true);
  });

  it('is false for a user object with isAdmin false or missing', () => {
    expect(hasAdminAccess({ isAdmin: false })).toBe(false);
    expect(hasAdminAccess({})).toBe(false);
  });

  it('is false for a plain role string', () => {
    expect(hasAdminAccess('CHAIRPERSON')).toBe(false);
  });
});

describe('canActAs', () => {
  it('allows a user whose role passes the check', () => {
    expect(canActAs({ role: 'FW', isAdmin: false }, canRecordContributions)).toBe(true);
  });

  it('allows an admin whose role does NOT pass the check', () => {
    // The Chairman is not in RECORD_CONTRIBUTION_ROLES, but isAdmin lets
    // the platform owner record contributions.
    expect(canActAs({ role: 'CHAIRPERSON', isAdmin: true }, canRecordContributions)).toBe(true);
    expect(canActAs({ role: 'CCD', isAdmin: true }, canRecordContributions)).toBe(true);
    expect(canActAs({ role: 'MEMBER', isAdmin: true }, canViewAllMembers)).toBe(true);
    expect(canActAs({ role: 'MEMBER', isAdmin: true }, canManageMembers)).toBe(true);
  });

  it('denies a non-admin whose role does not pass the check', () => {
    expect(canActAs({ role: 'CHAIRPERSON', isAdmin: false }, canRecordContributions)).toBe(false);
    expect(canActAs({ role: 'MEMBER', isAdmin: false }, canManageMembers)).toBe(false);
    expect(canActAs({ role: 'MEMBER', isAdmin: false }, canViewAllMembers)).toBe(false);
  });

  it('treats a missing isAdmin flag as not an admin', () => {
    expect(canActAs({ role: 'CHAIRPERSON' }, canRecordContributions)).toBe(false);
  });
});

describe('role sets', () => {
  it('excludes the Chairman from recording contributions by role alone', () => {
    // Worth pinning: the Chairman relies on the admin override, not on the
    // role list. If someone later adds CHAIRPERSON to this list, this test
    // tells them the override is no longer the thing doing the work.
    expect(canRecordContributions('CHAIRPERSON')).toBe(false);
    expect(canRecordContributions('CCD')).toBe(false);
  });

  it('allows the Treasurer, Deputy Treasurer and FW to record contributions', () => {
    expect(canRecordContributions('TREASURER')).toBe(true);
    expect(canRecordContributions('DEPUTY_TREASURER')).toBe(true);
    expect(canRecordContributions('FW')).toBe(true);
  });

  it('allows the Chairman to view all members', () => {
    expect(canViewAllMembers('CHAIRPERSON')).toBe(true);
    expect(canViewAllMembers('MEMBER')).toBe(false);
  });
});

describe('canActAsAnyRole', () => {
  const LAND_ROLES = ['CCD', 'LSC_MEMBER', 'CHAIRPERSON', 'FW'];

  it('allows a user whose role is in the list', () => {
    expect(canActAsAnyRole({ role: 'CCD', isAdmin: false }, LAND_ROLES)).toBe(true);
    expect(canActAsAnyRole({ role: 'FW', isAdmin: false }, LAND_ROLES)).toBe(true);
  });

  it('denies a user whose role is not in the list', () => {
    expect(canActAsAnyRole({ role: 'MEMBER', isAdmin: false }, LAND_ROLES)).toBe(false);
    expect(canActAsAnyRole({ role: 'TREASURER', isAdmin: false }, LAND_ROLES)).toBe(false);
  });

  it('allows an admin whose role is not in the list', () => {
    // The land, businesses and reports pages gate on an inline role array
    // rather than one of the named helpers, so they need this separately.
    expect(canActAsAnyRole({ role: 'MEMBER', isAdmin: true }, LAND_ROLES)).toBe(true);
    expect(canActAsAnyRole({ role: 'CCD', isAdmin: true }, ['FW', 'CHAIRPERSON'])).toBe(true);
  });

  it('treats a missing isAdmin flag as not an admin', () => {
    expect(canActAsAnyRole({ role: 'MEMBER' }, LAND_ROLES)).toBe(false);
  });
});
