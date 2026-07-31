-- Lets a VALIDATED grade-import batch be resumed later without re-uploading the
-- file, same reason ImportBatch.uploadId was added (see migration
-- 20260721181500_add_import_batch_upload_id). Purely additive: one nullable
-- column on GradeImportBatch, no other table or row is touched.
ALTER TABLE "GradeImportBatch" ADD COLUMN "uploadId" TEXT;
