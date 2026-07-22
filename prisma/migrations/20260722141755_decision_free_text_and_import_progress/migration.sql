-- Convert Candidate.decision from a restrictive enum to free text so a decision
-- value never seen before (e.g. "Délibérations") can be stored and displayed
-- exactly as written, without ever requiring a future migration to add it.
-- Existing enum values (ADMIS/SESSIONNAIRE/REDOUBLE/ABSENT/ANNULE) are preserved
-- as-is: the USING cast keeps every existing row's text unchanged.
ALTER TABLE "Candidate" ALTER COLUMN "decision" TYPE TEXT USING "decision"::TEXT;

-- The admin-maintained synonym table (raw text -> one of the 5 known buckets)
-- keeps the same values; only its column type changes, same reasoning as above.
ALTER TABLE "DecisionMapping" ALTER COLUMN "decision" TYPE TEXT USING "decision"::TEXT;

-- The enum type is no longer referenced by any column - safe to drop.
DROP TYPE "Decision";

-- Tracks how many rows of a batch have been durably committed so a large
-- import can report real progress and resume after an interruption without
-- redoing already-inserted rows.
ALTER TABLE "ImportBatch" ADD COLUMN "rowsImported" INTEGER NOT NULL DEFAULT 0;
