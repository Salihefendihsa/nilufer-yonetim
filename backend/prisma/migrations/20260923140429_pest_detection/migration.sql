-- CreateTable
CREATE TABLE "PestDetection" (
    "id" TEXT NOT NULL,
    "jobPhotoId" TEXT NOT NULL,
    "detectedPestType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "model" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PestDetection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PestDetection_jobPhotoId_key" ON "PestDetection"("jobPhotoId");

-- CreateIndex
CREATE INDEX "PestDetection_analyzedAt_idx" ON "PestDetection"("analyzedAt");

-- AddForeignKey
ALTER TABLE "PestDetection" ADD CONSTRAINT "PestDetection_jobPhotoId_fkey" FOREIGN KEY ("jobPhotoId") REFERENCES "JobPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
