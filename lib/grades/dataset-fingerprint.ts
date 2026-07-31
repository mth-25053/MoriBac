import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * A precise fingerprint of "has the subject scheme for this year/type changed" -
 * hashes every scheme row's content and updatedAt, not just a count, so an
 * edited coefficient or name is detected, not only additions/removals.
 */
export async function computeSchemeChecksum(examYearId: string, examType: string) {
  const schemes = await withDatabaseRetry(
    () => db.subjectScheme.findMany({
      where: { examYearId, examType },
      orderBy: [{ series: "asc" }, { subjectCode: "asc" }],
      select: { id: true, series: true, subjectCode: true, nameAr: true, nameFr: true, coefficient: true, displayOrder: true, updatedAt: true }
    }),
    "grade-import-scheme-checksum-read",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
  return hash(schemes);
}

/**
 * Candidate rows have no updatedAt and no update path in this app - they are
 * only ever created by an ImportBatch commit/resume or removed by an
 * ImportBatch undo. Fingerprinting the (small) set of ImportBatch rows for this
 * exam year, plus the candidate count, captures every real mutation path
 * without hashing tens of thousands of candidate rows directly.
 */
export async function computeCandidateDatasetChecksum(examYearId: string) {
  const batches = await withDatabaseRetry(
    () => db.importBatch.findMany({ where: { examYearId }, orderBy: { id: "asc" }, select: { id: true, status: true, rowsImported: true } }),
    "grade-import-candidate-checksum-batches-read",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
  const candidateCount = await withDatabaseRetry(
    () => db.candidate.count({ where: { examYearId } }),
    "grade-import-candidate-checksum-count-read",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
  return hash({ batches, candidateCount });
}
