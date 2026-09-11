-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Staff_archivedAt_idx" ON "Staff"("archivedAt");
