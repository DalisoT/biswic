/**
 * POST /api/admin/bootstrap
 * ----------------------------------------------------------------------------
 * One-time bootstrap for the 74 founding members (10 officers + 63 from the
 * nominal roll + 1 to be supplied by the user). Idempotent: re-running does
 * nothing for users that already exist.
 *
 * To run:
 *   1. Set the BOOTSTRAP_TOKEN env var in Vercel (any random string >= 16 chars).
 *   2. Open in a browser (or curl):
 *        https://<your-app>.vercel.app/api/admin/bootstrap
 *      with header `x-bootstrap-token: <the same value>` (or query param
 *      `?token=<value>` -- both are accepted for curl/Postman convenience).
 *   3. Read the JSON report. `created` are net-new sign-ins now available;
 *      `alreadyExisted` skipped.
 *   4. Delete this file when done (or leave it -- the token gates it).
 *
 * Default password for the 73: same as the seed (ChangeMe123! unless
 * overridden by env). The user changes it on first login via the reset flow.
 *
 * Migrations 0001-0007 must be applied to the Supabase DB first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { FOUNDING_MEMBERS } from '../../../../../prisma/founding-members';

interface OfficerSeed {
  serviceNumber: string;
  fullName: string;
  role: 'CHAIRPERSON' | 'VICE_CHAIRPERSON' | 'CCD' | 'FW' | 'SECRETARY' | 'TREASURER' | 'DEPUTY_TREASURER' | 'TRUSTEE';
  rank: string;
  unit: string;
  phone: string;
}

// The 10 Main Committee officers (Constitution Art. 6.1). Kept inline here
// because the seed script's password defaults differ from the bootstrap
// route's; we don't want a behaviour coupling between the two.
//
// CCD-001 has been replaced by the REAL CCD: SGT TEMBO R, service number
// 106759 (from the nominal roll). The placeholder 'Maj. Peter Zulu' on
// service number CCD-001 was wrong -- TEMBO R is on the roll instead.
// To keep the total at 10, 106759 is removed from the FOUNDING_MEMBERS
// list in prisma/founding-members.ts.
const OFFICERS: OfficerSeed[] = [
  { serviceNumber: 'CHAIR-001', fullName: 'Col. James Mwamba',     role: 'CHAIRPERSON',      rank: 'Colonel',         unit: 'HQ',       phone: '+260971000001' },
  { serviceNumber: 'VICE-001', fullName: 'Maj. Sylvia Banda',    role: 'VICE_CHAIRPERSON', rank: 'Major',           unit: 'HQ',       phone: '+260971000002' },
  { serviceNumber: '106759',   fullName: 'Sgt. Tembo R',         role: 'CCD',              rank: 'SGT',             unit: 'TBD',     phone: '+260950106759' },
  { serviceNumber: 'FW-001',   fullName: 'Capt. Grace Mutale',   role: 'FW',               rank: 'Captain',         unit: 'Finance', phone: '+260971000004' },
  { serviceNumber: 'SEC-001',  fullName: 'Lt. David Phiri',      role: 'SECRETARY',        rank: 'Lieutenant',       unit: 'Admin',    phone: '+260971000005' },
  { serviceNumber: 'TR-001',   fullName: 'WO2 Mary Tembo',       role: 'TREASURER',        rank: 'Warrant Officer 2', unit: 'Finance', phone: '+260971000006' },
  { serviceNumber: 'DTR-001',  fullName: 'Sgt. John Lungu',      role: 'DEPUTY_TREASURER', rank: 'Sergeant',        unit: 'Finance', phone: '+260971000007' },
  { serviceNumber: 'TRUSTEE-001', fullName: 'Maj. Robert Chileshe', role: 'TRUSTEE',         rank: 'Major',           unit: 'HQ',       phone: '+260971000008' },
  { serviceNumber: 'TRUSTEE-002', fullName: 'Capt. Elizabeth Sakala', role: 'TRUSTEE',       rank: 'Captain',         unit: 'HQ',       phone: '+260971000009' },
  { serviceNumber: 'TRUSTEE-003', fullName: 'WO1 Thomas Mwanza',  role: 'TRUSTEE',         rank: 'Warrant Officer 1', unit: 'HQ',     phone: '+260971000010' },
];

const SEED_DOMAIN = process.env.SEED_EMAIL_DOMAIN || 'biswic.coop';
const OFFICER_PASSWORD = process.env.SEED_OFFICER_PASSWORD || 'ChangeMe123!';
const MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD || 'ChangeMe123!';
const FOUNDING_REGISTER_DATE = new Date('2026-07-22');

async function ensureUser(opts: {
  serviceNumber: string;
  fullName: string;
  role: string;
  rank?: string;
  unit?: string;
  phone: string;
  password: string;
  isFoundingMember: boolean;
}) {
  const admin = createAdminClient();
  const email = `${opts.serviceNumber.toLowerCase()}@${SEED_DOMAIN}`;

  // 1) Find existing auth user
  let userId: string | null = null;
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    const msg = listError.message || JSON.stringify(listError);
    throw new Error(`listUsers failed: ${msg}`);
  }
  const existing = listData?.users.find((u) => u.email === email);
  if (existing) {
    userId = existing.id;
  } else {
    // CRITICAL: user_metadata MUST include all fields the handle_new_auth_user()
    // trigger reads (migration 0003). The trigger RAISES if any required field
    // is missing -- the resulting Supabase admin error message is "{}", which
    // is impossible to debug without knowing this. Required fields:
    //   service_number, full_name, role (defaults to 'MEMBER'), phone (RAISES)
    // We also include rank, unit, is_founding_member for downstream consumers.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: opts.password,
      email_confirm: true,
      user_metadata: {
        service_number: opts.serviceNumber,
        full_name: opts.fullName,
        role: opts.role,
        phone: opts.phone,
        rank: opts.rank ?? '',
        unit: opts.unit ?? '',
        is_founding_member: opts.isFoundingMember ? 'true' : 'false',
      },
    });
    if (error) {
      const msg = error.message || JSON.stringify(error);
      throw new Error(`createUser(${email}) failed: ${msg}`);
    }
    if (!data.user) throw new Error('createUser returned no user');
    userId = data.user.id;
  }

  // 2) Upsert the public.User row with the fields the trigger doesn't set
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      serviceNumber: opts.serviceNumber,
      fullName: opts.fullName,
      email,
      role: opts.role as any,
      rank: opts.rank ?? null,
      unit: opts.unit ?? null,
      phone: opts.phone,
      isActive: true,
      isFoundingMember: opts.isFoundingMember,
      foundingSignedAt: opts.isFoundingMember ? FOUNDING_REGISTER_DATE : null,
    },
    create: {
      id: userId,
      serviceNumber: opts.serviceNumber,
      fullName: opts.fullName,
      email,
      role: opts.role as any,
      rank: opts.rank ?? null,
      unit: opts.unit ?? null,
      phone: opts.phone,
      isActive: true,
      isFoundingMember: opts.isFoundingMember,
      foundingSignedAt: opts.isFoundingMember ? FOUNDING_REGISTER_DATE : null,
    },
  });

  return userId;
}

export async function GET(request: NextRequest) {
  const expected = process.env.BOOTSTRAP_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'BOOTSTRAP_TOKEN is not set on the server. Add it in Vercel env vars and redeploy.' },
      { status: 503 },
    );
  }
  const provided =
    request.nextUrl.searchParams.get('token') ??
    request.headers.get('x-bootstrap-token') ??
    '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const created: { serviceNumber: string; id: string }[] = [];
  const alreadyExisted: { serviceNumber: string; id: string }[] = [];
  const errors: { serviceNumber: string; message: string }[] = [];

  // Officers
  for (const o of OFFICERS) {
    try {
      // Check if public.User already exists
      const existing = await prisma.user.findUnique({
        where: { serviceNumber: o.serviceNumber },
        select: { id: true, email: true },
      });
      if (existing) {
        alreadyExisted.push({ serviceNumber: o.serviceNumber, id: existing.id });
        continue;
      }
      const id = await ensureUser({
        serviceNumber: o.serviceNumber,
        fullName: o.fullName,
        role: o.role,
        rank: o.rank,
        unit: o.unit,
        phone: o.phone,
        password: OFFICER_PASSWORD,
        isFoundingMember: true,
      });
      created.push({ serviceNumber: o.serviceNumber, id });
    } catch (err: any) {
      const message = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err) ?? 'unknown');
      console.error(`[bootstrap] officer ${o.serviceNumber} failed:`, err);
      errors.push({ serviceNumber: o.serviceNumber, message });
    }
  }

  // Members from the nominal roll
  for (const m of FOUNDING_MEMBERS) {
    try {
      const existing = await prisma.user.findUnique({
        where: { serviceNumber: m.serviceNumber },
        select: { id: true },
      });
      if (existing) {
        alreadyExisted.push({ serviceNumber: m.serviceNumber, id: existing.id });
        continue;
      }
      const id = await ensureUser({
        serviceNumber: m.serviceNumber,
        fullName: m.fullName,
        role: 'MEMBER',
        rank: m.rank,
        unit: m.unit,
        phone: m.phone,
        password: MEMBER_PASSWORD,
        isFoundingMember: true,
      });
      created.push({ serviceNumber: m.serviceNumber, id });
    } catch (err: any) {
      const message = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err) ?? 'unknown');
      console.error(`[bootstrap] member ${m.serviceNumber} failed:`, err);
      errors.push({ serviceNumber: m.serviceNumber, message });
    }
  }

  return NextResponse.json({
    summary: {
      totalTarget: OFFICERS.length + FOUNDING_MEMBERS.length,
      created: created.length,
      alreadyExisted: alreadyExisted.length,
      errors: errors.length,
    },
    created,
    alreadyExisted,
    errors,
    note:
      'Constitution Art. 2.2 says 74 founding members. This bootstrap creates 73 (10 officers + 63 from the nominal roll). The 74th row is still missing from the source document -- add it to prisma/founding-members.ts and re-run.',
  });
}
