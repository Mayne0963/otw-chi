/*
  Warnings:

  - You are about to drop the column `requestId` on the `DriverAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `DriverEarnings` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `DriverLocationPing` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `DriverTelemetry` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `NIPLedger` table. All the data in the column will be lost.
  - You are about to drop the `Request` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RequestEvent` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[driverId]` on the table `DriverEarnings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('APPROVED', 'FLAGGED', 'REJECTED', 'PENDING');

-- DropForeignKey
ALTER TABLE "DriverAssignment" DROP CONSTRAINT "DriverAssignment_requestId_fkey";

-- DropForeignKey
ALTER TABLE "DriverLocationPing" DROP CONSTRAINT "DriverLocationPing_requestId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_assignedDriverId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_cityId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "RequestEvent" DROP CONSTRAINT "RequestEvent_requestId_fkey";

-- DropIndex
DROP INDEX "DriverAssignment_requestId_idx";

-- DropIndex
DROP INDEX "DriverEarnings_driverId_requestId_key";

-- DropIndex
DROP INDEX "DriverLocationPing_requestId_idx";

-- DropIndex
DROP INDEX "DriverTelemetry_requestId_idx";

-- AlterTable
ALTER TABLE "DriverAssignment" DROP COLUMN "requestId";

-- AlterTable
ALTER TABLE "DriverEarnings" DROP COLUMN "requestId";

-- AlterTable
ALTER TABLE "DriverLocationPing" DROP COLUMN "requestId";

-- AlterTable
ALTER TABLE "DriverTelemetry" DROP COLUMN "requestId";

-- AlterTable
ALTER TABLE "NIPLedger" DROP COLUMN "requestId";

-- DropTable
DROP TABLE "Request";

-- DropTable
DROP TABLE "RequestEvent";

-- DropEnum
DROP TYPE "RequestStatus";

-- CreateTable
CREATE TABLE "ReceiptVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "expectedVendor" TEXT,
    "merchantName" TEXT,
    "subtotalAmount" DECIMAL(65,30),
    "taxAmount" DECIMAL(65,30),
    "tipAmount" DECIMAL(65,30),
    "totalAmount" DECIMAL(65,30),
    "receiptDate" TIMESTAMP(3),
    "currency" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "imageHash" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptVerification_imageHash_key" ON "ReceiptVerification"("imageHash");

-- CreateIndex
CREATE INDEX "ReceiptVerification_userId_idx" ON "ReceiptVerification"("userId");

-- CreateIndex
CREATE INDEX "ReceiptVerification_deliveryRequestId_idx" ON "ReceiptVerification"("deliveryRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverEarnings_driverId_key" ON "DriverEarnings"("driverId");

-- AddForeignKey
ALTER TABLE "ReceiptVerification" ADD CONSTRAINT "ReceiptVerification_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
