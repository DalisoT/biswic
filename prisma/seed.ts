/**
 * Seed Script (rewritten for Supabase Auth)
 * ----------------------------------------------------------------------------
 * Creates the cooperative's baseline data:
 * - 6 Buckets (percentages from config)
 * - 10 Main Committee users (chair, vice, ccd, fw, secretary, treasurer, deputy treasurer, 3 trustees)
 * - N Members (from config.defaultSeedMemberCount)
 * - 12 months of sample contributions
 * - 2 sample welfare claims
 * - 3 sample meetings
 * - 1 Constitution document
 * - 1 sample land opportunity
 * - 2 sample events
 * - 1 sample charity project
 *
 * All counts are derived from config - NEVER hardcode.
 *
 * Each user is created in TWO places:
 *   1. Supabase auth.users (via admin.createUser) -- the trigger in
 *      supabase/migrations/0003_post_prisma.sql then mirrors this into
 *      public."User" with id, serviceNumber, fullName, email, role.
 *   2. We then upsert the public."User" row with the remaining fields
 *      (phone, rank, unit) the trigger does not set. The upsert is
 *      idempotent so re-running the seed is safe.
 */

import { PrismaClient, type Role as PrismaRole } from '@prisma/client';
import { createAdminClient } from '../src/lib/supabase/admin';
import { config, isInInitialPeriod } from '../src/lib/config';
import { allocateToBuckets, assertAllocationsSumExactly } from '../src/lib/buckets';
import { logAudit, AUDIT_ACTIONS } from '../src/lib/audit';
import { FOUNDING_MEMBERS } from './founding-members';

const prisma = new PrismaClient();

const OFFICER_PASSWORD = process.env.SEED_OFFICER_PASSWORD || 'ChangeMe123!';
const MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD || 'ChangeMe123!';
const SEED_DOMAIN = process.env.SEED_EMAIL_DOMAIN || 'biswic.coop';

// Constitution Art. 2.2: founding register signed 22 July 2026.
const FOUNDING_REGISTER_DATE = new Date('2026-07-22');

type SeedRole =
  | 'CHAIRPERSON'
  | 'VICE_CHAIRPERSON'
  | 'CCD'
  | 'FW'
  | 'SECRETARY'
  | 'TREASURER'
  | 'DEPUTY_TREASURER'
  | 'TRUSTEE'
  | 'MEMBER';

interface SeedUserInput {
  serviceNumber: string;
  fullName: string;
  role: SeedRole;
  password: string;
  phone: string;
  rank?: string;
  unit?: string;
  isFoundingMember?: boolean;
  foundingSignedAt?: Date;
}

/**
 * Idempotently create the auth.users row + the public."User" row.
 * The auth trigger (0003) creates the public row from raw_user_meta_data;
 * we upsert afterwards to fill in phone/rank/unit/phone (which the
 * trigger does not set) and to handle the case where the trigger was
 * not yet deployed (the upsert is the source of truth).
 */
async function ensureUser(input: SeedUserInput): Promise<string> {
  const admin = createAdminClient();
  const email = `${input.serviceNumber.toLowerCase()}@${SEED_DOMAIN}`;

  // Look up existing auth user by email. listUsers is paginated but with
  // <100 seeded users this is a single call.
  let userId: string;
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;
  const existing = listData.users.find((u) => u.email === email);
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true, // skip email confirmation in dev
      user_metadata: {
        service_number: input.serviceNumber,
        full_name: input.fullName,
        role: input.role,
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('createUser returned no user');
    userId = data.user.id;
  }

  // Idempotent upsert of the public row. The trigger from 0003 will have
  // already inserted a minimal row (id, serviceNumber, fullName, email,
  // role, isActive=true, joinedAt=now). We update the fields it skipped.
  //
  // For founding members, joinedAt MUST be foundingSignedAt (the date they
  // signed the founding register), not the seed run date. Otherwise the
  // /finance defaulters page filters them all out (joinedAt > 1st of the
  // current month) and the page wrongly says "everyone paid" for the month
  // after the seed.
  const joinedAt = input.foundingSignedAt ?? new Date();

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      serviceNumber: input.serviceNumber,
      fullName: input.fullName,
      email,
      role: input.role as PrismaRole,
      rank: input.rank ?? null,
      unit: input.unit ?? null,
      phone: input.phone,
      isActive: true,
      isFoundingMember: input.isFoundingMember ?? false,
      foundingSignedAt: input.foundingSignedAt ?? null,
      joinedAt,
    },
    create: {
      id: userId,
      serviceNumber: input.serviceNumber,
      fullName: input.fullName,
      email,
      role: input.role as PrismaRole,
      rank: input.rank ?? null,
      unit: input.unit ?? null,
      phone: input.phone,
      isActive: true,
      isFoundingMember: input.isFoundingMember ?? false,
      foundingSignedAt: input.foundingSignedAt ?? null,
      joinedAt,
    },
  });

  return userId;
}

async function main() {
  console.log('Seeding BISWIC database...');
  console.log(`Cooperative start: ${config.cooperativeStartDate.toISOString()}`);
  console.log(`In initial 24-month period: ${isInInitialPeriod()}`);
  console.log(`Seed member count: ${config.defaultSeedMemberCount}`);

  // ---------------------------------------------------------------------------
  // 1. Buckets
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating buckets ---');
  const buckets = [];
  for (const [, b] of Object.entries(config.buckets)) {
    const bucket = await prisma.bucket.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        percentage: b.percentage / 100,
      },
      create: {
        code: b.code,
        name: b.name,
        percentage: b.percentage / 100,
        description: `${b.percentage}% of every contribution allocated to this bucket`,
      },
    });
    console.log(`  ${bucket.code}: ${bucket.name} (${b.percentage}%)`);
    buckets.push(bucket);
  }

  // ---------------------------------------------------------------------------
  // 2. Committee users (chair, vice, ccd, fw, secretary, treasurer, etc.)
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating committee users ---');

  const committee: SeedUserInput[] = [
    { serviceNumber: 'CHAIR-001', fullName: 'Col. James Mwamba', role: 'CHAIRPERSON', rank: 'Colonel', unit: 'HQ', phone: '+260971000001', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'VICE-001', fullName: 'Maj. Sylvia Banda', role: 'VICE_CHAIRPERSON', rank: 'Major', unit: 'HQ', phone: '+260971000002', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    // CCD: real person from the nominal roll -- 106759 SGT TEMBO R
    // (was previously a placeholder 'Maj. Peter Zulu' on service number CCD-001)
    { serviceNumber: '106759', fullName: 'Sgt. Tembo R', role: 'CCD', rank: 'SGT', unit: 'TBD', phone: '+260950106759', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'FW-001', fullName: 'Capt. Grace Mutale', role: 'FW', rank: 'Captain', unit: 'Finance', phone: '+260971000004', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'SEC-001', fullName: 'Lt. David Phiri', role: 'SECRETARY', rank: 'Lieutenant', unit: 'Admin', phone: '+260971000005', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'TR-001', fullName: 'WO2 Mary Tembo', role: 'TREASURER', rank: 'Warrant Officer 2', unit: 'Finance', phone: '+260971000006', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'DTR-001', fullName: 'Sgt. John Lungu', role: 'DEPUTY_TREASURER', rank: 'Sergeant', unit: 'Finance', phone: '+260971000007', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'TRUSTEE-001', fullName: 'Maj. Robert Chileshe', role: 'TRUSTEE', rank: 'Major', unit: 'HQ', phone: '+260971000008', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'TRUSTEE-002', fullName: 'Capt. Elizabeth Sakala', role: 'TRUSTEE', rank: 'Captain', unit: 'HQ', phone: '+260971000009', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
    { serviceNumber: 'TRUSTEE-003', fullName: 'WO1 Thomas Mwanza', role: 'TRUSTEE', rank: 'Warrant Officer 1', unit: 'HQ', phone: '+260971000010', password: OFFICER_PASSWORD, isFoundingMember: true, foundingSignedAt: FOUNDING_REGISTER_DATE },
  ];

  // Make sure FW and CHAIR exist first because the rest of the seed
  // references their ids (for "recordedBy" / "approvedBy" fields).
  const fwUserId = await ensureUser(committee.find((c) => c.serviceNumber === 'FW-001')!);
  const chairUserId = await ensureUser(committee.find((c) => c.serviceNumber === 'CHAIR-001')!);

  for (const c of committee) {
    await ensureUser(c);
    console.log(`  ${c.serviceNumber}: ${c.fullName} (${c.role})`);
  }

  // ---------------------------------------------------------------------------
  // 3. Members (the 63 non-officer founding members from the nominal roll)
  // ---------------------------------------------------------------------------
  // Constitution Art. 2.2: the 74 founding members are the persons who signed
  // the founding register. The 10 officers are in the committee list above;
  // these 63 are the non-officer members. (1 founding member is missing from
  // the source roll -- see founding-members.ts header for the count note.)
  //
  // The roles for some of these members will be assigned later by the
  // Chairperson/Secretary via the in-app "Edit Member" UI. Until then, all
  // roll members default to role: MEMBER.
  console.log(`\n--- Creating ${FOUNDING_MEMBERS.length} founding members from the nominal roll ---`);
  const memberIds: string[] = [];
  for (const fm of FOUNDING_MEMBERS) {
    const userId = await ensureUser({
      serviceNumber: fm.serviceNumber,
      fullName: fm.fullName,
      role: 'MEMBER',
      rank: fm.rank,
      unit: fm.unit,
      phone: fm.phone,
      password: MEMBER_PASSWORD,
      isFoundingMember: true,
      foundingSignedAt: FOUNDING_REGISTER_DATE,
    });
    memberIds.push(userId);
  }

  // ---------------------------------------------------------------------------
  // 4. 12 months of contributions (Jan-Dec 2026)
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating 12 months of contributions ---');
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const year = 2026;
  let contributionCount = 0;

  for (const memberId of memberIds) {
    for (const month of months) {
      const exists = await prisma.contribution.findUnique({
        where: { memberId_month_year: { memberId, month, year } },
      });
      if (exists) continue;

      const amount = config.monthlyContributionPerMember;
      const receivedAt = new Date(year, month - 1, 5);

      const allocationInput = buckets.map((b) => ({
        bucketId: b.id,
        bucketCode: b.code,
        percentage: Number(b.percentage) * 100,
      }));

      const allocations = allocateToBuckets(amount, allocationInput);
      assertAllocationsSumExactly(amount, allocations);

      const c = await prisma.contribution.create({
        data: {
          memberId,
          amount,
          month,
          year,
          paymentMethod: 'PAYROLL_DEDUCTION',
          receiptNumber: `RCT-${year}-${String(month).padStart(2, '0')}-${memberId.slice(-6).toUpperCase()}`,
          receivedAt,
          recordedById: fwUserId,
          allocations: {
            create: allocations.map((a) => ({
              bucketId: a.bucketId,
              amount: a.amount,
            })),
          },
        },
      });

      for (const a of allocations) {
        await prisma.bucket.update({
          where: { id: a.bucketId },
          data: { balance: { increment: a.amount } },
        });
        await prisma.bucketTransaction.create({
          data: {
            bucketId: a.bucketId,
            amount: a.amount,
            type: 'CONTRIBUTION_ALLOCATION',
            referenceType: 'Contribution',
            referenceId: c.id,
          },
        });
      }
      contributionCount++;
    }
  }
  console.log(`  Created ${contributionCount} contributions`);

  // ---------------------------------------------------------------------------
  // 5. Sample welfare claims
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating sample welfare claims ---');
  const funeralBucket = buckets.find((b) => b.code === 'FUNERAL')!;
  const medicalBucket = buckets.find((b) => b.code === 'MEDICAL')!;

  // 1 funeral claim: approved and paid
  const sampleMember1 = memberIds[0];
  const existingFuneral = await prisma.welfareClaim.findFirst({
    where: { memberId: sampleMember1, type: 'FUNERAL' },
  });
  if (!existingFuneral) {
    const funeralClaim = await prisma.welfareClaim.create({
      data: {
        memberId: sampleMember1,
        type: 'FUNERAL',
        beneficiary: 'parent',
        eventDate: new Date(2026, 5, 15),
        amountRequested: 8000,
        amountApproved: 8000,
        bucketId: funeralBucket.id,
        status: 'PAID',
        approvedByFwId: fwUserId,
        approvedByFwAt: new Date(2026, 5, 17),
        approvedByChairId: chairUserId,
        approvedByChairAt: new Date(2026, 5, 17),
        description: "Death of member's father. Burial certificate #BC-2026-1234.",
        supportingDocUrl: '/sample-docs/bc-2026-1234.pdf',
        paidAt: new Date(2026, 5, 18),
      },
    });
    await prisma.bucket.update({
      where: { id: funeralBucket.id },
      data: { balance: { decrement: 8000 } },
    });
    await prisma.bucketTransaction.create({
      data: {
        bucketId: funeralBucket.id,
        amount: -8000,
        type: 'WELFARE_PAYOUT',
        referenceType: 'WelfareClaim',
        referenceId: funeralClaim.id,
      },
    });
  }

  // 1 medical claim: pending
  const sampleMember2 = memberIds[1];
  const existingMedical = await prisma.welfareClaim.findFirst({
    where: { memberId: sampleMember2, type: 'MEDICAL' },
  });
  if (!existingMedical) {
    await prisma.welfareClaim.create({
      data: {
        memberId: sampleMember2,
        type: 'MEDICAL',
        beneficiary: 'spouse',
        eventDate: new Date(2026, 6, 20),
        amountRequested: 2500,
        status: 'PENDING',
        description: 'Spouse hospital admission - maternity emergency.',
        supportingDocUrl: '/sample-docs/hospital-2026-5678.pdf',
      },
    });
  }
  console.log('  1 approved funeral claim + 1 pending medical claim');

  // ---------------------------------------------------------------------------
  // 6. Sample meetings
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating sample meetings ---');
  const secUser = await prisma.user.findUnique({ where: { serviceNumber: 'SEC-001' } });
  if (!secUser) throw new Error('Secretary not found after committee creation');

  const meetingsToCreate = [
    {
      title: 'March 2026 Monthly Meeting',
      type: 'MONTHLY' as const,
      scheduledAt: new Date(2026, 2, 15, 10, 0),
      venue: 'BISWIC Hall, Camp HQ',
      agenda: '1. Welcome and apologies\n2. Approval of previous minutes\n3. Financial report\n4. Welfare claims\n5. Land update\n6. AOB',
      minutes: 'Meeting called to order at 10:05. All committee members present. Treasury balance reviewed. One funeral claim approved.',
      status: 'COMPLETED' as const,
    },
    {
      title: 'April 2026 Monthly Meeting',
      type: 'MONTHLY' as const,
      scheduledAt: new Date(2026, 3, 15, 10, 0),
      venue: 'BISWIC Hall, Camp HQ',
      agenda: '1. Welcome\n2. Financial report\n3. Land scout update\n4. Welfare claims\n5. AOB',
      minutes: 'All present. CCD reported on land scout findings. Approved expenditure for due diligence.',
      status: 'COMPLETED' as const,
    },
    {
      title: 'August 2026 Monthly Meeting',
      type: 'MONTHLY' as const,
      scheduledAt: new Date(2026, 7, 15, 10, 0),
      venue: 'BISWIC Hall, Camp HQ',
      agenda: 'Agenda to be finalized',
      status: 'SCHEDULED' as const,
    },
  ];

  for (const m of meetingsToCreate) {
    const existing = await prisma.meeting.findFirst({ where: { title: m.title } });
    if (!existing) {
      await prisma.meeting.create({ data: { ...m, createdById: secUser.id } });
    }
  }
  console.log('  Created 3 meetings (2 past, 1 upcoming)');

  // ---------------------------------------------------------------------------
  // 7. Constitution document
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating sample documents ---');
  const existingDoc = await prisma.document.findFirst({
    where: { title: 'BISWIC Constitution (2025 Edition)' },
  });
  if (!existingDoc) {
    await prisma.document.create({
      data: {
        title: 'BISWIC Constitution (2025 Edition)',
        description: 'The foundational Constitution of the Brothers in Service Welfare, Land & Investment Cooperative.',
        fileUrl: '/sample-docs/constitution.pdf',
        fileType: 'application/pdf',
        fileSize: 245000,
        category: 'CONSTITUTION',
        accessLevel: 'MEMBER',
        uploadedById: fwUserId,
      },
    });
  }
  console.log('  Created Constitution document');

  // ---------------------------------------------------------------------------
  // 8. Sample land opportunity
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating sample land opportunity ---');
  const ccdUser = await prisma.user.findUnique({ where: { serviceNumber: 'CCD-001' } });
  if (!ccdUser) throw new Error('CCD not found after committee creation');
  const existingLand = await prisma.landOpportunity.findFirst({
    where: { title: 'Plot along Great North Road' },
  });
  if (!existingLand) {
    await prisma.landOpportunity.create({
      data: {
        title: 'Plot along Great North Road',
        location: '15km North of Camp HQ, along Great North Road',
        gpsCoords: '-15.4163, 28.2812',
        sizeHectares: 1.5,
        sizeSqm: 15000,
        askingPrice: 450000,
        valuationPrice: 480000,
        status: 'SCOUTED',
        notes: 'Good access road, power lines at boundary, water borehole on neighbouring plot.',
        addedById: ccdUser.id,
      },
    });
  }
  console.log('  Created 1 land opportunity');

  // ---------------------------------------------------------------------------
  // 9. Sample events
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating sample events ---');
  const chairUserRec = await prisma.user.findUnique({ where: { serviceNumber: 'CHAIR-001' } });
  if (!chairUserRec) throw new Error('Chair not found after committee creation');
  const eventsToCreate = [
    {
      title: '2026 Annual General Meeting',
      description: 'Annual review of financials, election of new committee, strategic planning.',
      type: 'AGM' as const,
      startAt: new Date(2026, 11, 12, 9, 0),
      endAt: new Date(2026, 11, 12, 17, 0),
      venue: 'BISWIC Hall, Camp HQ',
      isPublic: false,
      report: 'AGM held successfully. Budget approved. Committee re-elected for 2027.',
    },
    {
      title: '2026 Family Day',
      description: 'Annual social event for members and families. Food, sports, games.',
      type: 'FAMILY_DAY' as const,
      startAt: new Date(2026, 9, 10, 10, 0),
      endAt: new Date(2026, 9, 10, 18, 0),
      venue: 'Camp Sports Ground',
      isPublic: false,
    },
  ];
  for (const e of eventsToCreate) {
    const existing = await prisma.event.findFirst({ where: { title: e.title } });
    if (!existing) {
      await prisma.event.create({ data: { ...e, createdById: chairUserRec.id } });
    }
  }
  console.log('  Created 2 events (1 past AGM, 1 upcoming Family Day)');

  // ---------------------------------------------------------------------------
  // 10. Sample charity project
  // ---------------------------------------------------------------------------
  console.log('\n--- Creating sample charity project ---');
  const existingCharity = await prisma.charityProject.findFirst({
    where: { name: 'Visit to Lusaka Central Orphanage' },
  });
  if (!existingCharity) {
    await prisma.charityProject.create({
      data: {
        name: 'Visit to Lusaka Central Orphanage',
        description: 'Members visited and donated food, blankets, and school supplies.',
        budget: 15000,
        spent: 14200,
        startDate: new Date(2026, 4, 1),
        endDate: new Date(2026, 4, 15),
        status: 'COMPLETED',
        beneficiaries: '42 children',
        impact: 'Distributed food, blankets, and learning materials. Positive engagement with caretakers.',
        photosJson: JSON.stringify([]),
      },
    });
  }
  console.log('  Created 1 charity project (orphanage visit)');

  // ---------------------------------------------------------------------------
  // Initial audit log entry
  // ---------------------------------------------------------------------------
  await logAudit({
    action: AUDIT_ACTIONS.CREATE,
    entity: 'Seed',
    notes: `Initial seed: ${FOUNDING_MEMBERS.length} founding members, 10 committee, 6 buckets (Constitution Art. 4.1 mix)`,
  });

  console.log('\nSeed complete!');
  console.log('\n--- LOGIN CREDENTIALS ---');
  console.log(`Officers: service number [CHAIR-001 / FW-001 / etc] + password: ${OFFICER_PASSWORD}`);
  console.log(`Members:  service number [real 6-digit service number from the roll] + password: ${MEMBER_PASSWORD}`);
  console.log(`\nEmails are: <service-number-lowercase>@${SEED_DOMAIN}`);
  console.log(`\nNOTE: Constitution Art. 2.2 says 74 founding members. The roll has 63; plus 10 officers = 73.`);
  console.log(`      The 74th member is missing from the source document. Add their row to founding-members.ts and re-seed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
