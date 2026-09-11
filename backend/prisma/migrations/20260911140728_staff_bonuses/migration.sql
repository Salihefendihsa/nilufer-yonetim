-- CreateEnum
CREATE TYPE "StaffBonusStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'BONUS';

-- AlterTable
ALTER TABLE "EvaluationPeriod" ADD COLUMN     "bonusAmount" DECIMAL(10,2),
ADD COLUMN     "bonusThreshold" INTEGER;

-- CreateTable
CREATE TABLE "StaffBonus" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "evaluationPeriodId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "StaffBonusStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffBonus_evaluationId_key" ON "StaffBonus"("evaluationId");

-- CreateIndex
CREATE INDEX "StaffBonus_staffId_idx" ON "StaffBonus"("staffId");

-- CreateIndex
CREATE INDEX "StaffBonus_evaluationPeriodId_idx" ON "StaffBonus"("evaluationPeriodId");

-- CreateIndex
CREATE INDEX "StaffBonus_status_idx" ON "StaffBonus"("status");

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_evaluationPeriodId_fkey" FOREIGN KEY ("evaluationPeriodId") REFERENCES "EvaluationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBonus" ADD CONSTRAINT "StaffBonus_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
