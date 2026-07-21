-- Administrator-driven mapping for decision text the importer does not recognize.
-- Purely additive: does not alter Candidate, the Decision enum, or any existing row.
CREATE TABLE "DecisionMapping" (
  "id" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "rawValue" TEXT NOT NULL,
  "decision" "Decision",
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DecisionMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DecisionMapping_normalizedKey_key" ON "DecisionMapping"("normalizedKey");
CREATE INDEX "DecisionMapping_decision_idx" ON "DecisionMapping"("decision");
