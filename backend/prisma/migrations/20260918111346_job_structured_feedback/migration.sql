-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "feedbackComment" TEXT,
ADD COLUMN     "feedbackSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "punctualityScore" INTEGER,
ADD COLUMN     "serviceQualityScore" INTEGER,
ADD COLUMN     "staffProfessionalismScore" INTEGER,
ADD COLUMN     "wouldRecommend" BOOLEAN;
