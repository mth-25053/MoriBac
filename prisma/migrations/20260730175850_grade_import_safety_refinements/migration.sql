-- AlterTable
-- Fingerprints captured at dry-run time and re-verified at commit, so a commit
-- fails cleanly (instead of silently importing something different from what
-- was reviewed) if the subject scheme or candidate dataset changed in between.
ALTER TABLE "GradeImportBatch" ADD COLUMN     "candidateDatasetChecksum" TEXT NOT NULL,
ADD COLUMN     "schemeChecksum" TEXT NOT NULL;

-- Partial unique index: at most one IMPORTING batch per exam year. This is the
-- real safety net against two concurrent commits for the same year (the
-- application also pre-checks before starting, but only this index is race-safe
-- under two simultaneous requests). Not expressible in schema.prisma - Prisma's
-- DSL has no partial-index syntax, so this exists only here.
CREATE UNIQUE INDEX "GradeImportBatch_one_importing_per_year" ON "GradeImportBatch"("examYearId") WHERE "status" = 'IMPORTING';
