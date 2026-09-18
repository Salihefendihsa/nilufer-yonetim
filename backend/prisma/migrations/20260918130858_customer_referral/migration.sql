-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredByCustomerId" TEXT;

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "referralCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Customer_referredByCustomerId_idx" ON "Customer"("referredByCustomerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referredByCustomerId_fkey" FOREIGN KEY ("referredByCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

