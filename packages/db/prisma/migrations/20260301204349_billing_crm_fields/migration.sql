/*
  Warnings:

  - The `status` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE');

-- AlterTable
ALTER TABLE "doctor_visits" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nextVisitDate" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "city" TEXT,
ADD COLUMN     "clinicAddress" TEXT,
ADD COLUMN     "lastVisitDate" TIMESTAMP(3),
ADD COLUMN     "registrationNumber" TEXT,
ALTER COLUMN "engagementScore" SET DEFAULT 50;

-- AlterTable
ALTER TABLE "insurance_claims" ADD COLUMN     "approvedAmount" DECIMAL(12,2),
ADD COLUMN     "insurerName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ALTER COLUMN "insurerId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "pdfUrl" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "actualValue" DECIMAL(15,2),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "expectedValue" DECIMAL(15,2),
ADD COLUMN     "lostAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "organizationName" TEXT,
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recordedById" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NoteType" NOT NULL DEFAULT 'NOTE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_notes_leadId_idx" ON "lead_notes"("leadId");

-- CreateIndex
CREATE INDEX "doctor_visits_tenantId_visitedAt_idx" ON "doctor_visits"("tenantId", "visitedAt");

-- CreateIndex
CREATE INDEX "doctors_tenantId_city_idx" ON "doctors"("tenantId", "city");

-- CreateIndex
CREATE INDEX "leads_tenantId_assignedToId_idx" ON "leads"("tenantId", "assignedToId");

-- CreateIndex
CREATE INDEX "payments_tenantId_paidAt_idx" ON "payments"("tenantId", "paidAt");

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
