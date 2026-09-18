-- CreateTable
CREATE TABLE "JobTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "defaultPrice" DECIMAL(10,2),
    "defaultDurationMinutes" INTEGER,
    "defaultNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTemplate_isActive_idx" ON "JobTemplate"("isActive");
