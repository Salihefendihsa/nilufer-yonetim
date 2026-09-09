-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('AVAILABLE', 'ON_JOB', 'ON_BREAK', 'ON_LEAVE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('BIOCIDAL', 'CONSUMABLE', 'EQUIPMENT');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "amount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "relatedId" TEXT,
ADD COLUMN     "relatedType" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'BIOCIDAL';

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "amount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "status" "StaffStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "statusUntil" TIMESTAMP(3);
