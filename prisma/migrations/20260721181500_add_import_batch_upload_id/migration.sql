-- Lets a VALIDATED import batch be completed later without re-uploading the file.
-- Purely additive: adds one nullable column to ImportBatch, does not alter Candidate,
-- the Decision enum, or any existing row.
ALTER TABLE "ImportBatch" ADD COLUMN "uploadId" TEXT;
