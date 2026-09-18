-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "warrantyExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceType" ADD COLUMN     "defaultWarrantyDays" INTEGER;
