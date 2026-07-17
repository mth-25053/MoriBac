-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('ADMIS', 'SESSIONNAIRE', 'REDOUBLE', 'ABSENT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('VALIDATED', 'IMPORTED', 'FAILED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamYear" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "candidateNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "average" DECIMAL(5,2) NOT NULL,
    "decision" "Decision" NOT NULL,
    "wilaya" TEXT NOT NULL,
    "examCenter" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "birthDate" TEXT,
    "birthPlace" TEXT,
    "examYearId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "examYearId" TEXT NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT,
    "message" TEXT NOT NULL,
    "rawData" JSONB,
    "importBatchId" TEXT NOT NULL,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ExamYear_year_key" ON "ExamYear"("year");

-- CreateIndex
CREATE INDEX "ExamYear_isPublished_isDefault_idx" ON "ExamYear"("isPublished", "isDefault");

-- CreateIndex
CREATE INDEX "Candidate_candidateNumber_idx" ON "Candidate"("candidateNumber");

-- CreateIndex
CREATE INDEX "Candidate_series_idx" ON "Candidate"("series");

-- CreateIndex
CREATE INDEX "Candidate_examCenter_idx" ON "Candidate"("examCenter");

-- CreateIndex
CREATE INDEX "Candidate_school_idx" ON "Candidate"("school");

-- CreateIndex
CREATE INDEX "Candidate_wilaya_idx" ON "Candidate"("wilaya");

-- CreateIndex
CREATE INDEX "Candidate_average_idx" ON "Candidate"("average");

-- CreateIndex
CREATE INDEX "Candidate_examYearId_series_average_idx" ON "Candidate"("examYearId", "series", "average");

-- CreateIndex
CREATE INDEX "Candidate_examYearId_examCenter_idx" ON "Candidate"("examYearId", "examCenter");

-- CreateIndex
CREATE INDEX "Candidate_examYearId_school_idx" ON "Candidate"("examYearId", "school");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_examYearId_candidateNumber_key" ON "Candidate"("examYearId", "candidateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_checksum_key" ON "ImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "ImportBatch_examYearId_createdAt_idx" ON "ImportBatch"("examYearId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_adminId_idx" ON "ImportBatch"("adminId");

-- CreateIndex
CREATE INDEX "ImportError_importBatchId_idx" ON "ImportError"("importBatchId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
