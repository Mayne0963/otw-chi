-- AddEnumValue
ALTER TYPE "DriverApplicationStatus" ADD VALUE IF NOT EXISTS 'WAITLIST';

-- CreateEnum
CREATE TYPE "DriverCandidateProfile" AS ENUM (
  'RETIRED_PROFESSIONAL',
  'VETERAN',
  'EDUCATOR',
  'HEALTHCARE',
  'CHURCH_ADMIN',
  'POSTAL_WORKER',
  'GOVERNMENT_EMPLOYEE',
  'OTHER'
);

-- AlterTable
ALTER TABLE "DriverApplication"
ADD COLUMN     "candidateProfile" "DriverCandidateProfile",
ADD COLUMN     "patienceScore" INTEGER,
ADD COLUMN     "communicationScore" INTEGER,
ADD COLUMN     "reliabilityScore" INTEGER,
ADD COLUMN     "attitudeScore" INTEGER,
ADD COLUMN     "alignmentScore" INTEGER,
ADD COLUMN     "minScore" INTEGER,
ADD COLUMN     "interviewNotes" TEXT,
ADD COLUMN     "patienceAnswer" TEXT,
ADD COLUMN     "customerCareAnswer" TEXT,
ADD COLUMN     "instructionsAnswer" TEXT,
ADD COLUMN     "whyOtwAnswer" TEXT,
ADD COLUMN     "scoredAt" TIMESTAMP(3);

