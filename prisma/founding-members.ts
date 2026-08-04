/**
 * Founding Members Nominal Roll — extracted from WALFARE WARRIORS-1.docx on 2026-08-04.
 * ------------------------------------------------------------------------
 * 63 non-officer founding members (the 10 officers are in seed.ts).
 * NOTE: Constitution says 74 founding members; this roll + 10 officers = 73.
 *      One member is missing from the source document. The user will provide.
 *
 * Columns: serviceNumber (real military service number, NOT the placeholder
 *          CHAIR-001 style used in the seed officers), fullName (surname + first
 *          initial as in the roll), rank, unit, phone (placeholder, deterministic).
 *
 * When the user adds roles for some of these via the in-app 'Edit Member' UI,
 * update this file or update the User.role field directly. Service numbers are
 * immutable — they're real military numbers from the nominal roll.
 */

export interface FoundingMemberEntry {
  serviceNumber: string;
  fullName: string;
  rank: string;
  unit: string;
  phone: string;
}

export const FOUNDING_MEMBERS: FoundingMemberEntry[] = [
  { serviceNumber: '105644', fullName: 'MATE L', rank: 'SSGT', unit: 'TBD', phone: '+260950105644' },
  { serviceNumber: '105550', fullName: 'LUTANGU O', rank: 'SSGT', unit: 'TBD', phone: '+260950105550' },
  { serviceNumber: '105370', fullName: 'KASAMBO P', rank: 'SSGT', unit: 'TBD', phone: '+260950105370' },
  { serviceNumber: '104865', fullName: 'CHAMA J', rank: 'SSGT', unit: 'TBD', phone: '+260950104865' },
  { serviceNumber: '105716', fullName: 'MKEMBA W', rank: 'SSGT', unit: 'TBD', phone: '+260950105716' },
  { serviceNumber: '106302', fullName: 'NEEBA G', rank: 'SSGT', unit: 'TBD', phone: '+260950106302' },
  { serviceNumber: '106303', fullName: 'NENGUKE R', rank: 'SSGT', unit: 'TBD', phone: '+260950106303' },
  { serviceNumber: '105257', fullName: 'KAKOMA R', rank: 'SSGT', unit: 'TBD', phone: '+260950105257' },
  { serviceNumber: '104760', fullName: 'AKAPELWA A', rank: 'SGT', unit: 'TBD', phone: '+260950104760' },
  { serviceNumber: '104784', fullName: 'BANDA L', rank: 'SGT', unit: 'TBD', phone: '+260950104784' },
  { serviceNumber: '104797', fullName: 'BANDA S', rank: 'SGT', unit: 'TBD', phone: '+260950104797' },
  { serviceNumber: '104879', fullName: 'CHANDA C', rank: 'SGT', unit: 'TBD', phone: '+260950104879' },
  { serviceNumber: '104905', fullName: 'CHANGWE M', rank: 'SGT', unit: 'TBD', phone: '+260950104905' },
  { serviceNumber: '104914', fullName: 'CHEWE D', rank: 'SGT', unit: 'TBD', phone: '+260950104914' },
  { serviceNumber: '104968', fullName: 'CHILAMBE I', rank: 'SGT', unit: 'TBD', phone: '+260950104968' },
  { serviceNumber: '104969', fullName: 'CHILAMBE P', rank: 'SGT', unit: 'TBD', phone: '+260950104969' },
  { serviceNumber: '105046', fullName: 'CHIRWA J', rank: 'SGT', unit: 'TBD', phone: '+260950105046' },
  { serviceNumber: '105065', fullName: 'CHISENGA A', rank: 'SGT', unit: 'TBD', phone: '+260950105065' },
  { serviceNumber: '105069', fullName: 'CHISHA A V', rank: 'SGT', unit: 'TBD', phone: '+260950105069' },
  { serviceNumber: '105079', fullName: 'CHISHIMBA C', rank: 'SGT', unit: 'TBD', phone: '+260950105079' },
  { serviceNumber: '105099', fullName: 'CHIWALA T', rank: 'SGT', unit: 'TBD', phone: '+260950105099' },
  { serviceNumber: '105151', fullName: 'SIANGA C F', rank: 'SGT', unit: 'TBD', phone: '+260950105151' },
  { serviceNumber: '105152', fullName: 'FWOLOSHI T', rank: 'SGT', unit: 'TBD', phone: '+260950105152' },
  { serviceNumber: '105217', fullName: 'KABENDE S', rank: 'SGT', unit: 'TBD', phone: '+260950105217' },
  { serviceNumber: '105242', fullName: 'KAFULA R', rank: 'SGT', unit: 'TBD', phone: '+260950105242' },
  { serviceNumber: '105294', fullName: 'KAMANGA E', rank: 'SGT', unit: 'TBD', phone: '+260950105294' },
  { serviceNumber: '105328', fullName: 'KANGWA A', rank: 'SGT', unit: 'TBD', phone: '+260950105328' },
  { serviceNumber: '105334', fullName: 'KANGWA N', rank: 'SGT', unit: 'TBD', phone: '+260950105334' },
  { serviceNumber: '105399', fullName: 'KASONTA L', rank: 'SGT', unit: 'TBD', phone: '+260950105399' },
  { serviceNumber: '105469', fullName: 'KUNDA G', rank: 'SGT', unit: 'TBD', phone: '+260950105469' },
  { serviceNumber: '105600', fullName: 'MALISHENI A', rank: 'SGT', unit: 'TBD', phone: '+260950105600' },
  { serviceNumber: '105636', fullName: 'NAMAFE M', rank: 'SGT', unit: 'TBD', phone: '+260950105636' },
  { serviceNumber: '105638', fullName: 'MAPOLISA A', rank: 'SGT', unit: 'TBD', phone: '+260950105638' },
  { serviceNumber: '105725', fullName: 'MOONO A', rank: 'SGT', unit: 'TBD', phone: '+260950105725' },
  { serviceNumber: '105801', fullName: 'MKOSHA J', rank: 'SGT', unit: 'TBD', phone: '+260950105801' },
  { serviceNumber: '106140', fullName: 'MWANSA J', rank: 'SGT', unit: 'TBD', phone: '+260950106140' },
  { serviceNumber: '106147', fullName: 'MWANSA M J', rank: 'SGT', unit: 'TBD', phone: '+260950106147' },
  { serviceNumber: '106180', fullName: 'MWANZA W', rank: 'SGT', unit: 'TBD', phone: '+260950106180' },
  { serviceNumber: '106288', fullName: 'HATEMBO N', rank: 'SGT', unit: 'TBD', phone: '+260950106288' },
  { serviceNumber: '106312', fullName: 'NG’OMBE B', rank: 'SGT', unit: 'TBD', phone: '+260950106312' },
  { serviceNumber: '106324', fullName: 'NGOMA C', rank: 'SGT', unit: 'TBD', phone: '+260950106324' },
  { serviceNumber: '106366', fullName: 'NKANDU R', rank: 'SGT', unit: 'TBD', phone: '+260950106366' },
  { serviceNumber: '106481', fullName: 'PHIRI L', rank: 'SGT', unit: 'TBD', phone: '+260950106481' },
  { serviceNumber: '106529', fullName: 'SAKALA F', rank: 'SGT', unit: 'TBD', phone: '+260950106529' },
  { serviceNumber: '106542', fullName: 'SAKAUMBA I', rank: 'SGT', unit: 'TBD', phone: '+260950106542' },
  { serviceNumber: '106593', fullName: 'SIAME A', rank: 'SGT', unit: 'TBD', phone: '+260950106593' },
  { serviceNumber: '106633', fullName: 'SIKUKA E', rank: 'SGT', unit: 'TBD', phone: '+260950106633' },
  { serviceNumber: '106641', fullName: 'SILUME K', rank: 'SGT', unit: 'TBD', phone: '+260950106641' },
  { serviceNumber: '106645', fullName: 'SILUPYA R', rank: 'SGT', unit: 'TBD', phone: '+260950106645' },
  { serviceNumber: '106691', fullName: 'SINYANGWE K', rank: 'SGT', unit: 'TBD', phone: '+260950106691' },
  { serviceNumber: '106788', fullName: 'YASINI J', rank: 'SGT', unit: 'TBD', phone: '+260950106788' },
  { serviceNumber: '106809', fullName: 'ZULU E', rank: 'SGT', unit: 'TBD', phone: '+260950106809' },
  { serviceNumber: '1051301', fullName: 'CHUNGU I', rank: 'SGT', unit: 'TBD', phone: '+260951051301' },
  { serviceNumber: '104783', fullName: 'BANDA J', rank: 'CPL', unit: 'TBD', phone: '+260950104783' },
  { serviceNumber: '104812', fullName: 'BUPE R', rank: 'CPL', unit: 'TBD', phone: '+260950104812' },
  { serviceNumber: '105346', fullName: 'KAPANGE H', rank: 'CPL', unit: 'TBD', phone: '+260950105346' },
  { serviceNumber: '105358', fullName: 'KAPITA S', rank: 'CPL', unit: 'TBD', phone: '+260950105358' },
  { serviceNumber: '106010', fullName: 'MUTAMBO S', rank: 'CPL', unit: 'TBD', phone: '+260950106010' },
  { serviceNumber: '106075', fullName: 'MWALE K K', rank: 'CPL', unit: 'TBD', phone: '+260950106075' },
  { serviceNumber: '106108', fullName: 'MWANDILA D', rank: 'SGT', unit: 'TBD', phone: '+260950106108' },
  { serviceNumber: '106592', fullName: 'SIAMOAZOMBA W', rank: 'CPL', unit: 'TBD', phone: '+260950106592' },
  { serviceNumber: '106708', fullName: 'SIWALE S', rank: 'CPL', unit: 'TBD', phone: '+260950106708' },
];

