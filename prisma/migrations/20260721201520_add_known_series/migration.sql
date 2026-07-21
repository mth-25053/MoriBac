-- Admin-visible registry of series values seen so far, purely for informational
-- "new series detected" reporting during import (never blocking, never rejecting).
-- Purely additive: new table only, no touch to Candidate or any existing row.
CREATE TABLE "KnownSeries" (
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnownSeries_pkey" PRIMARY KEY ("code")
);

-- One-time seed from existing candidate data so already-known series (BAC 2021/2024/2025)
-- never spuriously appear as "new" on the next import. Reads Candidate, writes nothing to it.
INSERT INTO "KnownSeries" ("code", "createdAt")
SELECT DISTINCT "series", CURRENT_TIMESTAMP FROM "Candidate"
ON CONFLICT ("code") DO NOTHING;
