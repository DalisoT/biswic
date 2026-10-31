/**
 * BISWIC member roster.
 * ---------------------------------------------------------------------------
 * SYNCHRONISED WITH THE LIVE DATABASE on 2026-10-31, from the Members screen.
 *
 * WHY THIS FILE EXISTS
 *
 * The seed used to carry a hand-typed nominal roll that had drifted from the
 * live database. That drift was not cosmetic -- it caused real problems:
 *
 *   - Five members who joined after the founding register (and one whose
 *     rank had changed) were missing entirely.
 *   - The committee were still placeholder accounts (CHAIR-001 "Col. James
 *     Mwamba", VICE-001 "Maj. Sylvia Banda", FW-001, SEC-001, TR-001,
 *     DTR-001, TRUSTEE-001..003). The real officers were people on the roll.
 *   - Several service numbers had been corrected in the app, e.g. 106708 is
 *     SUCHILILA S (the seed had "SIWALE S").
 *   - Service 106147 MWANSA M J is the Chairperson, and 106759 RICHARD TEMBO
 *     is the Chair of Capital Development.
 *
 * Resolving a payment list against a stale roster silently mis-attributes
 * money, so the roster below is now the live truth.
 *
 * Columns: serviceNumber (real military service number -- immutable),
 *          fullName, rank, unit, phone.
 *
 * IMPORTANT: the seed must NOT overwrite roles, activation state or join
 * dates that were set through the app. See `preserveExisting` in seed.ts.
 */

export interface FoundingMemberEntry {
  serviceNumber: string;
  fullName: string;
  rank: string;
  unit: string;
  phone: string;
}

/** A member admitted after the founding register was signed. */
export interface LateJoinerEntry extends FoundingMemberEntry {
  /** ISO date the member joined. */
  joinedAt: string;
}

/**
 * The founding roll, in the role of ordinary Member.
 *
 * The officers are NOT in this list -- they are in COMMITTEE below. Keeping
 * them apart means the seed cannot demote an officer by seeding them again
 * as MEMBER.
 */
export const FOUNDING_MEMBERS: FoundingMemberEntry[] = [
  { serviceNumber: '104760', fullName: 'AKAPELWA A', rank: 'SGT', unit: '1CDO', phone: '+260 95 010 4760' },
  { serviceNumber: '104783', fullName: 'BANDA J', rank: 'CPL', unit: 'TBD', phone: '+260 95 010 4783' },
  { serviceNumber: '104784', fullName: 'BANDA L', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 4784' },
  { serviceNumber: '104797', fullName: 'BANDA S', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 4797' },
  { serviceNumber: '104812', fullName: 'BUPE R', rank: 'CPL', unit: 'TBD', phone: '+260 95 010 4812' },
  { serviceNumber: '104865', fullName: 'CHAMA J', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 4865' },
  { serviceNumber: '104905', fullName: 'CHANGWE M', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 4905' },
  { serviceNumber: '104914', fullName: 'CHEWE D', rank: 'SSGT', unit: '1CDO', phone: '+26072220778' },
  { serviceNumber: '104968', fullName: 'CHILAMBE I', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 4968' },
  { serviceNumber: '104969', fullName: 'CHILAMBE P', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 4969' },
  { serviceNumber: '105046', fullName: 'CHIRWA J', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5046' },
  { serviceNumber: '105065', fullName: 'CHISENGA ABEL', rank: 'SGT', unit: '48 Marine', phone: '+260 97 998 9071' },
  { serviceNumber: '105069', fullName: 'CHISHA A V', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5069' },
  { serviceNumber: '105079', fullName: 'CHISHIMBA C', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5079' },
  { serviceNumber: '105099', fullName: 'CHIWALA T', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5099' },
  { serviceNumber: '1051301', fullName: 'CHUNGU I', rank: 'SGT', unit: 'TBD', phone: '+260 95 105 1301' },
  { serviceNumber: '105151', fullName: 'SIANGA C F', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5151' },
  { serviceNumber: '105217', fullName: 'KABENDE S', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5217' },
  { serviceNumber: '105242', fullName: 'KAFULA R', rank: 'SGT', unit: 'HQ3SFG', phone: '+260 97 812 4399' },
  { serviceNumber: '105257', fullName: 'KAKOMA R', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 5257' },
  { serviceNumber: '105294', fullName: 'KAMANGA E', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5294' },
  { serviceNumber: '105328', fullName: 'KANGWA A', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5328' },
  { serviceNumber: '105334', fullName: 'KANGWA N', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5334' },
  { serviceNumber: '105346', fullName: 'KAPANGE H', rank: 'CPL', unit: 'TBD', phone: '+260 95 010 5346' },
  { serviceNumber: '105358', fullName: 'KAPITA S', rank: 'CPL', unit: 'TBD', phone: '+260 95 010 5358' },
  { serviceNumber: '105370', fullName: 'KASAMBO P', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 5370' },
  { serviceNumber: '105399', fullName: 'KASONTA L', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5399' },
  { serviceNumber: '105469', fullName: 'KUNDA G', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5469' },
  { serviceNumber: '105550', fullName: 'LUTANGU O', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 5550' },
  { serviceNumber: '105600', fullName: 'MALISHENI A', rank: 'SGT', unit: 'SFTS', phone: '+260 97 675 0633' },
  { serviceNumber: '105636', fullName: 'NAMAFE M', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5636' },
  { serviceNumber: '105638', fullName: 'MAPOLISA A', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5638' },
  { serviceNumber: '105644', fullName: 'MATE L', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 5644' },
  { serviceNumber: '105725', fullName: 'MOONO A', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5725' },
  { serviceNumber: '105801', fullName: 'MKOSHA J', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 5801' },
  { serviceNumber: '106010', fullName: 'MUTAMBO S', rank: 'CPL', unit: 'TBD', phone: '+260 95 010 6010' },
  { serviceNumber: '106075', fullName: 'MWALE KELVIN KELLY', rank: 'CPL', unit: '48 MARINE KAWAMBWA', phone: '+260 95 010 6075' },
  { serviceNumber: '106108', fullName: 'MWANDILA D', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6108' },
  { serviceNumber: '106140', fullName: 'MWANSA J', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6140' },
  { serviceNumber: '106180', fullName: 'MWANZA W', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6180' },
  { serviceNumber: '106288', fullName: 'HATEMBO N', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6288' },
  { serviceNumber: '106303', fullName: 'NENGUKE R', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 6303' },
  { serviceNumber: '106312', fullName: 'NG’OMBE B', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6312' },
  { serviceNumber: '106324', fullName: 'NGOMA C', rank: 'SGT', unit: '1CDO', phone: '+260 77 901 9462' },
  { serviceNumber: '106366', fullName: 'NKANDU R', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6366' },
  { serviceNumber: '106481', fullName: 'PHIRI L', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6481' },
  { serviceNumber: '106529', fullName: 'SAKALA F', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6529' },
  { serviceNumber: '106542', fullName: 'SAKAUMBA I', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6542' },
  { serviceNumber: '106592', fullName: 'SIAMAZOMBA W', rank: 'CPL', unit: 'Marine', phone: '+260 95 010 6592' },
  { serviceNumber: '106593', fullName: 'SIAME A', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6593' },
  { serviceNumber: '106633', fullName: 'SIKUKA E', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6633' },
  { serviceNumber: '106641', fullName: 'SILUME K', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6641' },
  { serviceNumber: '106645', fullName: 'SILUPYA R', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6645' },
  { serviceNumber: '106691', fullName: 'SINYANGWE K', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6691' },
  { serviceNumber: '106708', fullName: 'SUCHILILA S', rank: 'CPL', unit: 'TBD', phone: '+260 95 010 6708' },
  { serviceNumber: '106788', fullName: 'YASINI J', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6788' },
  { serviceNumber: '106809', fullName: 'ZULU E', rank: 'SGT', unit: 'TBD', phone: '+260 95 010 6809' },
];

/**
 * Members admitted after the founding register was signed (22 July 2026).
 * They are NOT founding members, and they only owe contributions from their
 * own joining month onwards.
 */
export const LATE_JOINERS: LateJoinerEntry[] = [
  { serviceNumber: '106000', fullName: 'MUTALE JACK MWABA', rank: 'SGT', unit: '1CDO', phone: '+260 77 291 4116', joinedAt: '2026-08-06' },
  { serviceNumber: '106139', fullName: 'Mwansa Jacob', rank: 'LCPL', unit: '5ZR', phone: '+260 97 186 6556', joinedAt: '2026-08-08' },
  { serviceNumber: '105734', fullName: 'Mphande George', rank: '—', unit: '—', phone: '+260 97 100 0001', joinedAt: '2026-09-06' },
  { serviceNumber: '104916', fullName: 'Chewe J', rank: '—', unit: '—', phone: '+260 97 100 0007', joinedAt: '2026-09-07' },
];

/**
 * The committee, with the real officers and their real service numbers.
 *
 * The seed previously used placeholder accounts (CHAIR-001, VICE-001, FW-001,
 * SEC-001, TR-001, DTR-001, TRUSTEE-001..003). Those placeholders are gone
 * from the live database -- the committee is these six people.
 *
 * Note there is no Finance Warrant (FW) on the live committee. The role
 * still exists in the schema and permissions for when one is appointed, but
 * the seed must not invent an officer.
 */
export interface CommitteeEntry extends FoundingMemberEntry {
  role:
    | 'CHAIRPERSON'
    | 'VICE_CHAIRPERSON'
    | 'CCD'
    | 'SECRETARY'
    | 'TREASURER'
    | 'DEPUTY_TREASURER';
  /** The platform owner. Bypasses every role check; see permissions.ts. */
  isAdmin?: boolean;
}

export const COMMITTEE: CommitteeEntry[] = [
  { serviceNumber: '106147', fullName: 'MWANSA M J', rank: 'SGT', unit: 'SFTS', phone: '+260 97 056 9305', role: 'CHAIRPERSON' },
  { serviceNumber: '105152', fullName: 'FWOLOSHI T', rank: 'SGT', unit: 'SFTS', phone: '+260 97 261 2300', role: 'VICE_CHAIRPERSON' },
  { serviceNumber: '106759', fullName: 'RICHARD TEMBO', rank: 'SGT', unit: '1CDO', phone: '+260 97 798 1430', role: 'CCD', isAdmin: true },
  { serviceNumber: '104879', fullName: 'Chishimba Chanda', rank: 'SGT', unit: '1CDO', phone: '+260 97 795 8773', role: 'SECRETARY' },
  { serviceNumber: '106302', fullName: 'NEEBA GEORGE', rank: 'SSGT', unit: '1CDO', phone: '+260 95 010 6302', role: 'TREASURER' },
  { serviceNumber: '105716', fullName: 'MKEMBA W', rank: 'SSGT', unit: 'TBD', phone: '+260 95 010 5716', role: 'DEPUTY_TREASURER' },
];
