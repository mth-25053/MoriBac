-- Adds the composite indexes every public ranking/statistics query actually filters
-- by (examYearId + decision, examYearId + wilaya). Purely additive: does not alter
-- any existing index, column, the Decision enum, or any row.
CREATE INDEX "Candidate_examYearId_decision_idx" ON "Candidate"("examYearId", "decision");
CREATE INDEX "Candidate_examYearId_wilaya_idx" ON "Candidate"("examYearId", "wilaya");
