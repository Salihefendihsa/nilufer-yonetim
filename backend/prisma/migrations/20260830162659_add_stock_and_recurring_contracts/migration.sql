-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "nextGenerationDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceType" "RecurrenceType";

-- AlterTable
ALTER TABLE "JobReport" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "quantity" DECIMAL(10,2),
ALTER COLUMN "productsUsed" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" DECIMAL(10,2) NOT NULL,
    "criticalThreshold" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "relatedJobReportId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_relatedJobReportId_key" ON "StockMovement"("relatedJobReportId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "Contract_nextGenerationDate_idx" ON "Contract"("nextGenerationDate");

-- CreateIndex
CREATE INDEX "JobReport_productId_idx" ON "JobReport"("productId");

-- AddForeignKey
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_relatedJobReportId_fkey" FOREIGN KEY ("relatedJobReportId") REFERENCES "JobReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
