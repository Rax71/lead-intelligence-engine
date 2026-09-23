-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('IN_PROGRESS', 'READY', 'APPROVED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('ESTIMATED', 'PENDING_APPROVAL', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED_COST_LIMIT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'REVIEWED', 'CONTACTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "FeedbackEventType" AS ENUM ('CONTACTED', 'RESPONDED', 'INTERESTED', 'MEETING', 'PROPOSAL', 'SALE', 'NO_RESPONSE', 'WRONG_DATA', 'NO_FIT', 'LOST');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_states" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "answeredFields" JSONB NOT NULL DEFAULT '{}',
    "unknownFields" JSONB NOT NULL DEFAULT '[]',
    "inferredFields" JSONB NOT NULL DEFAULT '{}',
    "conflictingFields" JSONB NOT NULL DEFAULT '[]',
    "confidence" JSONB NOT NULL DEFAULT '{}',
    "activeBranch" TEXT,
    "completedBranches" JSONB NOT NULL DEFAULT '[]',
    "pendingBranches" JSONB NOT NULL DEFAULT '[]',
    "profileReadiness" INTEGER NOT NULL DEFAULT 0,
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "businessType" TEXT,
    "professionalType" TEXT,
    "industry" TEXT,
    "subindustry" TEXT,
    "productsServices" JSONB,
    "businessModel" TEXT,
    "idealCustomer" TEXT,
    "icp" JSONB,
    "targetSegments" JSONB,
    "prioritySegments" JSONB,
    "geography" JSONB,
    "preferredLocations" JSONB,
    "radiusKm" DOUBLE PRECISION,
    "companySize" TEXT,
    "employeeRange" JSONB,
    "revenueRange" JSONB,
    "ticketRange" JSONB,
    "decisionMaker" JSONB,
    "painPoints" JSONB,
    "needs" JSONB,
    "intentSignals" JSONB,
    "buyingSignals" JSONB,
    "growthSignals" JSONB,
    "urgencySignals" JSONB,
    "positiveCharacteristics" JSONB,
    "negativeCharacteristics" JSONB,
    "exclusions" JSONB,
    "preferredSources" JSONB,
    "preferredChannels" JSONB,
    "contactRequirements" JSONB,
    "recencyRequirements" JSONB,
    "scoringPreferences" JSONB,
    "outreachPreferences" JSONB,
    "successDefinition" TEXT,
    "constraints" JSONB,
    "assumptions" JSONB,
    "confidence" JSONB,
    "profileReadiness" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_specs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "location" JSONB NOT NULL,
    "what" JSONB NOT NULL,
    "discoveryStrategy" JSONB NOT NULL,
    "intentSignals" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL,
    "dataRequired" JSONB NOT NULL,
    "scoringRules" JSONB NOT NULL,
    "stopCriteria" JSONB NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actor_registry" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "pricingModel" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "maxItems" INTEGER,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "supportedSources" JSONB,
    "lastVerified" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "actor_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "prospectionSpecId" TEXT NOT NULL,
    "actorRegistryId" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'ESTIMATED',
    "maxItems" INTEGER,
    "maxRunCost" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "itemsCollected" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "runId" TEXT,
    "companyName" TEXT NOT NULL,
    "personName" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "neighborhood" TEXT,
    "industry" TEXT,
    "subindustry" TEXT,
    "employeeEstimate" TEXT,
    "companyAgeEstimate" TEXT,
    "intentLevel" TEXT,
    "leadScore" INTEGER,
    "confidenceScore" INTEGER,
    "temperature" TEXT,
    "fitReasons" JSONB,
    "intentReasons" JSONB,
    "painReasons" JSONB,
    "negativeSignals" JSONB,
    "evidence" JSONB,
    "sources" JSONB,
    "recommendedAction" TEXT,
    "recommendedChannel" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_events" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" "FeedbackEventType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_states_clientId_idx" ON "interview_states"("clientId");

-- CreateIndex
CREATE INDEX "client_profiles_clientId_idx" ON "client_profiles"("clientId");

-- CreateIndex
CREATE INDEX "prospection_specs_clientId_idx" ON "prospection_specs"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "actor_registry_actorId_key" ON "actor_registry"("actorId");

-- CreateIndex
CREATE INDEX "runs_clientId_idx" ON "runs"("clientId");

-- CreateIndex
CREATE INDEX "leads_clientId_idx" ON "leads"("clientId");

-- CreateIndex
CREATE INDEX "leads_runId_idx" ON "leads"("runId");

-- CreateIndex
CREATE INDEX "leads_leadScore_idx" ON "leads"("leadScore");

-- CreateIndex
CREATE INDEX "leads_temperature_idx" ON "leads"("temperature");

-- CreateIndex
CREATE INDEX "feedback_events_leadId_idx" ON "feedback_events"("leadId");

-- AddForeignKey
ALTER TABLE "interview_states" ADD CONSTRAINT "interview_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_specs" ADD CONSTRAINT "prospection_specs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_specs" ADD CONSTRAINT "prospection_specs_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_prospectionSpecId_fkey" FOREIGN KEY ("prospectionSpecId") REFERENCES "prospection_specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_actorRegistryId_fkey" FOREIGN KEY ("actorRegistryId") REFERENCES "actor_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
