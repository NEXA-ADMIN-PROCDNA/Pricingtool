-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SEL', 'DIRECTOR', 'ED', 'PARTNER', 'COFOUNDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('NEW', 'EXISTING');

-- CreateEnum
CREATE TYPE "LineOfBusiness" AS ENUM ('TECH', 'ANALYTICS', 'MS', 'DS', 'OTHERS');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'ABANDONED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'QUALIFICATION', 'PROPOSAL', 'SOW_SUBMITTED', 'SOW_SIGNED', 'PO_RECEIVED', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "Location" AS ENUM ('INDIA', 'US');

-- CreateEnum
CREATE TYPE "JobRole" AS ENUM ('ANALYST', 'SENIOR_ANALYST', 'CONSULTANT', 'SENIOR_CONSULTANT', 'MANAGER', 'SENIOR_MANAGER', 'DIRECTOR', 'ASSOCIATE_DIRECTOR', 'VICE_PRESIDENT', 'PRINCIPAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'STATUS_CHANGED', 'WEEKLY_REPORT', 'PRICING_UPDATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "kindeId" TEXT NOT NULL,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessUnit" TEXT,
    "industry" TEXT,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_pocs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,

    CONSTRAINT "client_pocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "opportunityName" TEXT NOT NULL,
    "opportunityType" "OpportunityType" NOT NULL DEFAULT 'NEW',
    "primaryLob" "LineOfBusiness" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "stage" "OpportunityStage" NOT NULL DEFAULT 'LEAD',
    "starConnect" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "coOwnerId" TEXT,
    "nextSteps" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL,
    "jobRole" "JobRole" NOT NULL,
    "location" "Location" NOT NULL,
    "costRatePerHour" DECIMAL(10,2) NOT NULL,
    "billRatePerHour" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ingestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_versions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "revenueSharePct" DECIMAL(8,4),
    "proposedBillings" DECIMAL(14,2),
    "totalCost" DECIMAL(14,2),
    "grossMarginPct" DECIMAL(8,4),
    "discountPremiumPct" DECIMAL(8,4),
    "effectiveRatePerHour" DECIMAL(10,2),
    "totalHours" DECIMAL(10,2),
    "offshorePct" DECIMAL(8,4),
    "businessJustification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_resources" (
    "id" TEXT NOT NULL,
    "pricingVersionId" TEXT NOT NULL,
    "rateCardId" TEXT,
    "resourceDesignation" "JobRole" NOT NULL,
    "location" "Location" NOT NULL DEFAULT 'INDIA',
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "systemBillRatePerHour" DECIMAL(10,2),
    "manualBillRatePerHour" DECIMAL(10,2),
    "discountPremiumPct" DECIMAL(8,4),
    "effectiveBillRate" DECIMAL(10,2),
    "costRatePerHour" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_week_entries" (
    "id" TEXT NOT NULL,
    "staffingResourceId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL DEFAULT 0,

    CONSTRAINT "staffing_week_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_costs" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "month" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_of_payments" (
    "id" TEXT NOT NULL,
    "pricingVersionId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "recommendedBillings" DECIMAL(12,2),
    "recommendedOtherCost" DECIMAL(12,2),
    "proposedBillings" DECIMAL(12,2),
    "proposedOtherCost" DECIMAL(12,2),
    "proposedIsManual" BOOLEAN NOT NULL DEFAULT false,
    "discountPct" DECIMAL(8,4),
    "premiumPct" DECIMAL(8,4),
    "discountIsManual" BOOLEAN NOT NULL DEFAULT false,
    "premiumIsManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_of_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_snapshots" (
    "id" TEXT NOT NULL,
    "pricingVersionId" TEXT NOT NULL,
    "month" TIMESTAMP(3),
    "revenueFromBilling" DECIMAL(12,2),
    "revenueFromOtherCost" DECIMAL(12,2),
    "totalRevenue" DECIMAL(12,2),
    "employeeCost" DECIMAL(12,2),
    "otherCost" DECIMAL(12,2),
    "grossMargin" DECIMAL(12,2),
    "grossMarginPct" DECIMAL(8,4),
    "discountPremiumPct" DECIMAL(8,4),
    "totalHours" DECIMAL(10,2),
    "offshoreRatio" DECIMAL(8,4),
    "billedRatePerHour" DECIMAL(10,2),
    "effectiveRatePerHour" DECIMAL(10,2),
    "indiaRate" DECIMAL(10,2),
    "usRate" DECIMAL(10,2),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sow_documents" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileUrl" TEXT,
    "externalLink" TEXT,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT DEFAULT 'application/pdf',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sow_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "ccEmails" TEXT[],
    "subject" TEXT NOT NULL,
    "opportunityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_kindeId_key" ON "users"("kindeId");

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "users"("managerId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientId_key" ON "clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_opportunityId_key" ON "opportunities"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_jobRole_location_effectiveFrom_key" ON "rate_cards"("jobRole", "location", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_versions_opportunityId_versionNumber_key" ON "pricing_versions"("opportunityId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_week_entries_staffingResourceId_weekStartDate_key" ON "staffing_week_entries"("staffingResourceId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_of_payments_pricingVersionId_month_key" ON "schedule_of_payments"("pricingVersionId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "financial_snapshots_pricingVersionId_month_key" ON "financial_snapshots"("pricingVersionId", "month");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pocs" ADD CONSTRAINT "client_pocs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_coOwnerId_fkey" FOREIGN KEY ("coOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_ingestedById_fkey" FOREIGN KEY ("ingestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_versions" ADD CONSTRAINT "pricing_versions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_resources" ADD CONSTRAINT "staffing_resources_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "pricing_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_resources" ADD CONSTRAINT "staffing_resources_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_week_entries" ADD CONSTRAINT "staffing_week_entries_staffingResourceId_fkey" FOREIGN KEY ("staffingResourceId") REFERENCES "staffing_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_costs" ADD CONSTRAINT "other_costs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_of_payments" ADD CONSTRAINT "schedule_of_payments_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "pricing_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_snapshots" ADD CONSTRAINT "financial_snapshots_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "pricing_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sow_documents" ADD CONSTRAINT "sow_documents_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sow_documents" ADD CONSTRAINT "sow_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
