-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ProductCategory" ADD VALUE 'DISINFECTANT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecurrenceType" ADD VALUE 'SEMIANNUAL';
ALTER TYPE "RecurrenceType" ADD VALUE 'ANNUAL';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "scheduledEndAt" TIMESTAMP(3),
ADD COLUMN     "sequenceNo" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "JobReport" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "collectedByStaffId" TEXT,
ADD COLUMN     "referenceNo" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "surveyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "dailyJobCapacity" INTEGER,
ADD COLUMN     "vehiclePlate" TEXT;

-- CreateTable
CREATE TABLE "StockPurchaseRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockPurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockPurchaseRequest_productId_idx" ON "StockPurchaseRequest"("productId");

-- CreateIndex
CREATE INDEX "StockPurchaseRequest_status_idx" ON "StockPurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "Job_sequenceNo_idx" ON "Job"("sequenceNo");

-- CreateIndex
CREATE INDEX "JobReport_approvedAt_idx" ON "JobReport"("approvedAt");

-- CreateIndex
CREATE INDEX "Payment_collectedByStaffId_idx" ON "Payment"("collectedByStaffId");

-- AddForeignKey
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPurchaseRequest" ADD CONSTRAINT "StockPurchaseRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPurchaseRequest" ADD CONSTRAINT "StockPurchaseRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPurchaseRequest" ADD CONSTRAINT "StockPurchaseRequest_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedByStaffId_fkey" FOREIGN KEY ("collectedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
