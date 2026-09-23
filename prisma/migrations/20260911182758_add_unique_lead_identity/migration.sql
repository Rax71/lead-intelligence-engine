/*
  Warnings:

  - A unique constraint covering the columns `[clientId,identityKey]` on the table `leads` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "leads_clientId_identityKey_idx";

-- CreateIndex
CREATE UNIQUE INDEX "leads_clientId_identityKey_key" ON "leads"("clientId", "identityKey");
