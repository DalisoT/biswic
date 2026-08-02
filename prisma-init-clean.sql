-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateEnum

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "serviceNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "rank" TEXT,
    "unit" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "nextOfKin" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notificationPrefs" JSONB,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'en',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bucket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percentage" DECIMAL(5,4) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BucketTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucketId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BucketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "memberId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "paymentMethod" "ContributionType" NOT NULL,
    "receiptNumber" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BucketAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contributionId" UUID NOT NULL,
    "bucketId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BucketAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelfareClaim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "memberId" UUID NOT NULL,
    "type" "ClaimType" NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "amountRequested" DECIMAL(14,2) NOT NULL,
    "amountApproved" DECIMAL(14,2),
    "bucketId" UUID,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "supportingDocUrl" TEXT,
    "description" TEXT,
    "approvedByFwId" UUID,
    "approvedByFwAt" TIMESTAMP(3),
    "approvedByChairId" UUID,
    "approvedByChairAt" TIMESTAMP(3),
    "capOverrideNote" TEXT,
    "rejectedReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelfareClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "agenda" TEXT,
    "minutes" TEXT,
    "minutesDocUrl" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meetingId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meetingId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'MEMBER',
    "uploadedById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandOpportunity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "gpsCoords" TEXT,
    "sizeHectares" DECIMAL(10,4) NOT NULL,
    "sizeSqm" DECIMAL(12,2) NOT NULL,
    "askingPrice" DECIMAL(14,2) NOT NULL,
    "valuationPrice" DECIMAL(14,2),
    "status" "LandStatus" NOT NULL DEFAULT 'SCOUTED',
    "photosJson" JSONB,
    "documentsJson" JSONB,
    "dueDiligence" JSONB,
    "notes" TEXT,
    "addedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandPurchase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunityId" UUID NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "deedUrl" TEXT,
    "totalPlots" INTEGER NOT NULL,
    "plotsAllocated" INTEGER NOT NULL DEFAULT 0,
    "communityPlots" INTEGER NOT NULL DEFAULT 1,
    "chairPlot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LandPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseId" UUID NOT NULL,
    "plotNumber" INTEGER NOT NULL,
    "memberId" UUID,
    "allocatedAt" TIMESTAMP(3),
    "status" "PlotStatus" NOT NULL DEFAULT 'UNALLOCATED',
    "notes" TEXT,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "capitalInvested" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentMonthlyProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "BusinessTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDecision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "decidedById" UUID NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "venue" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "photosJson" JSONB,
    "report" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRSVP" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "EventRSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharityProject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budget" DECIMAL(14,2) NOT NULL,
    "spent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "CharityStatus" NOT NULL DEFAULT 'PLANNING',
    "beneficiaries" TEXT,
    "impact" TEXT,
    "photosJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharityProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_serviceNumber_key" ON "User"("serviceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Bucket_name_key" ON "Bucket"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bucket_code_key" ON "Bucket"("code");

-- CreateIndex
CREATE INDEX "BucketTransaction_bucketId_createdAt_idx" ON "BucketTransaction"("bucketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_receiptNumber_key" ON "Contribution"("receiptNumber");

-- CreateIndex
CREATE INDEX "Contribution_year_month_idx" ON "Contribution"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_memberId_month_year_key" ON "Contribution"("memberId", "month", "year");

-- CreateIndex
CREATE INDEX "BucketAllocation_contributionId_idx" ON "BucketAllocation"("contributionId");

-- CreateIndex
CREATE INDEX "WelfareClaim_memberId_createdAt_idx" ON "WelfareClaim"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "WelfareClaim_status_idx" ON "WelfareClaim"("status");

-- CreateIndex
CREATE INDEX "WelfareClaim_type_createdAt_idx" ON "WelfareClaim"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendance_meetingId_memberId_key" ON "MeetingAttendance"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_accessLevel_idx" ON "Document"("accessLevel");

-- CreateIndex
CREATE UNIQUE INDEX "LandPurchase_opportunityId_key" ON "LandPurchase"("opportunityId");

-- CreateIndex
CREATE INDEX "Plot_purchaseId_idx" ON "Plot"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRSVP_eventId_memberId_key" ON "EventRSVP"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "BucketTransaction" ADD CONSTRAINT "BucketTransaction_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketAllocation" ADD CONSTRAINT "BucketAllocation_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketAllocation" ADD CONSTRAINT "BucketAllocation_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "Bucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareClaim" ADD CONSTRAINT "WelfareClaim_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareClaim" ADD CONSTRAINT "WelfareClaim_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "Bucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareClaim" ADD CONSTRAINT "WelfareClaim_approvedByFwId_fkey" FOREIGN KEY ("approvedByFwId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareClaim" ADD CONSTRAINT "WelfareClaim_approvedByChairId_fkey" FOREIGN KEY ("approvedByChairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandOpportunity" ADD CONSTRAINT "LandOpportunity_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandPurchase" ADD CONSTRAINT "LandPurchase_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "LandOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "LandPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessTransaction" ADD CONSTRAINT "BusinessTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDecision" ADD CONSTRAINT "BusinessDecision_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRSVP" ADD CONSTRAINT "EventRSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRSVP" ADD CONSTRAINT "EventRSVP_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

