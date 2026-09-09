-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "relatedJobReportProductId" TEXT;

-- CreateTable
CREATE TABLE "JobReportProduct" (
    "id" TEXT NOT NULL,
    "jobReportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobReportProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobReportProduct_jobReportId_idx" ON "JobReportProduct"("jobReportId");

-- CreateIndex
CREATE INDEX "JobReportProduct_productId_idx" ON "JobReportProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_relatedJobReportProductId_key" ON "StockMovement"("relatedJobReportProductId");

-- AddForeignKey
ALTER TABLE "JobReportProduct" ADD CONSTRAINT "JobReportProduct_jobReportId_fkey" FOREIGN KEY ("jobReportId") REFERENCES "JobReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReportProduct" ADD CONSTRAINT "JobReportProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_relatedJobReportProductId_fkey" FOREIGN KEY ("relatedJobReportProductId") REFERENCES "JobReportProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

