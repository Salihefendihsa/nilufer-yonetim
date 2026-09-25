-- CreateEnum
CREATE TYPE "StaffRequestCategory" AS ENUM ('EQUIPMENT', 'SUGGESTION', 'COMPLAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StaffRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "StaffRequest" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "StaffRequestCategory" NOT NULL DEFAULT 'OTHER',
    "status" "StaffRequestStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "StaffRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "respondedByUserId" TEXT,
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StaffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffRequest_staffUserId_idx" ON "StaffRequest"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffRequest_status_idx" ON "StaffRequest"("status");

-- CreateIndex
CREATE INDEX "StaffRequest_priority_idx" ON "StaffRequest"("priority");

-- AddForeignKey
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
