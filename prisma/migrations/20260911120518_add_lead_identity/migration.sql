-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "identityKey" TEXT,
ADD COLUMN     "placeId" TEXT;

-- CreateIndex
CREATE INDEX "leads_clientId_identityKey_idx" ON "leads"("clientId", "identityKey");

-- CreateIndex
CREATE INDEX "leads_clientId_placeId_idx" ON "leads"("clientId", "placeId");
