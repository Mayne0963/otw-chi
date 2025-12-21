-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "lastKnownAt" TIMESTAMP(3),
ADD COLUMN     "lastKnownLat" DOUBLE PRECISION,
ADD COLUMN     "lastKnownLng" DOUBLE PRECISION;
