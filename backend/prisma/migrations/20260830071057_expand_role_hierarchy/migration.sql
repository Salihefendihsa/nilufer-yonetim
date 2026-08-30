-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MANAGER';
ALTER TYPE "Role" ADD VALUE 'TEAM_LEAD';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "supervisorId" TEXT;

-- CreateTable
CREATE TABLE "AdvanceRequest" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvanceRequest_staffId_idx" ON "AdvanceRequest"("staffId");

-- CreateIndex
CREATE INDEX "AdvanceRequest_status_idx" ON "AdvanceRequest"("status");

-- CreateIndex
CREATE INDEX "Staff_supervisorId_idx" ON "Staff"("supervisorId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
