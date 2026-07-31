-- CreateEnum
CREATE TYPE "GradeImportSourceType" AS ENUM ('JSON', 'CSV', 'EXCEL');

-- CreateEnum
CREATE TYPE "GradeImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'IMPORTED', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "GradeSourceMapping" (
    "id" TEXT NOT NULL,
    "sourceType" "GradeImportSourceType" NOT NULL,
    "structureKey" TEXT NOT NULL,
    "fieldMapping" JSONB NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeSourceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectScheme" (
    "id" TEXT NOT NULL,
    "examYearId" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'bac',
    "series" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameFr" TEXT,
    "coefficient" DECIMAL(4,2),
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeImportBatch" (
    "id" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceType" "GradeImportSourceType" NOT NULL,
    "examYearId" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'bac',
    "checksum" TEXT NOT NULL,
    "status" "GradeImportStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validatedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "progressRows" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "dryRunReport" JSONB,
    "adminId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeImportError" (
    "id" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT,
    "message" TEXT NOT NULL,
    "rawData" JSONB,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "GradeImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSubjectGrade" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "subjectSchemeId" TEXT NOT NULL,
    "mark" DECIMAL(5,2) NOT NULL,
    "sourceBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSubjectGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeSourceMapping_sourceType_structureKey_key" ON "GradeSourceMapping"("sourceType", "structureKey");

-- CreateIndex
CREATE INDEX "SubjectScheme_examYearId_examType_series_idx" ON "SubjectScheme"("examYearId", "examType", "series");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectScheme_examYearId_examType_series_subjectCode_key" ON "SubjectScheme"("examYearId", "examType", "series", "subjectCode");

-- CreateIndex
CREATE UNIQUE INDEX "GradeImportBatch_checksum_key" ON "GradeImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "GradeImportBatch_examYearId_status_idx" ON "GradeImportBatch"("examYearId", "status");

-- CreateIndex
CREATE INDEX "GradeImportError_batchId_idx" ON "GradeImportError"("batchId");

-- CreateIndex
CREATE INDEX "CandidateSubjectGrade_sourceBatchId_idx" ON "CandidateSubjectGrade"("sourceBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSubjectGrade_candidateId_subjectSchemeId_key" ON "CandidateSubjectGrade"("candidateId", "subjectSchemeId");

-- AddForeignKey
ALTER TABLE "SubjectScheme" ADD CONSTRAINT "SubjectScheme_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeImportBatch" ADD CONSTRAINT "GradeImportBatch_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeImportBatch" ADD CONSTRAINT "GradeImportBatch_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeImportError" ADD CONSTRAINT "GradeImportError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GradeImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubjectGrade" ADD CONSTRAINT "CandidateSubjectGrade_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubjectGrade" ADD CONSTRAINT "CandidateSubjectGrade_subjectSchemeId_fkey" FOREIGN KEY ("subjectSchemeId") REFERENCES "SubjectScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubjectGrade" ADD CONSTRAINT "CandidateSubjectGrade_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "GradeImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
