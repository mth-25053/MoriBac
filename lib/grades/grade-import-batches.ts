import type { GradeImportSourceType, GradeImportStatus, GradeStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import type { ValidationReport } from "@/lib/grades/validate";

export class DuplicateGradeImportError extends Error {
  constructor() {
    super("DUPLICATE_FILE");
    this.name = "DuplicateGradeImportError";
  }
}

export class ConcurrentGradeImportError extends Error {
  constructor(readonly examYearId: string) {
    super("IMPORT_ALREADY_IN_PROGRESS");
    this.name = "ConcurrentGradeImportError";
  }
}

function isUniqueConstraintViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

export function chunks<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

/**
 * Kept fixed for the same reason INSERT_CHUNK_SIZE is fixed in lib/import-batches.ts:
 * resuming relies on progressRows always landing on an exact multiple of this size
 * (or the final total), so it can be turned straight back into a chunk index.
 */
const INSERT_CHUNK_SIZE = 2000;
const REPORT_PREVIEW_LIMIT = 200;

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/** Caps every category to a preview, same idea as errorSummary() capping ImportError previews at 100 - a 500k-row report has no business living whole in a JSONB column or an API response. */
function trimmedReport(report: ValidationReport) {
  const gradedCount = report.importable.filter((row) => row.status === "GRADED").length;
  const exemptCount = report.importable.filter((row) => row.status === "EXEMPT").length;
  return {
    importableCount: report.importable.length,
    gradedCount,
    exemptCount,
    unmatched: report.unmatched.slice(0, REPORT_PREVIEW_LIMIT),
    unmatchedCount: report.unmatched.length,
    seriesMismatch: report.seriesMismatch.slice(0, REPORT_PREVIEW_LIMIT),
    seriesMismatchCount: report.seriesMismatch.length,
    duplicateInputRows: report.duplicateInputRows.slice(0, REPORT_PREVIEW_LIMIT),
    duplicateInputRowsCount: report.duplicateInputRows.length,
    unknownSubjectCodes: report.unknownSubjectCodes.slice(0, REPORT_PREVIEW_LIMIT),
    unknownSubjectCodesCount: report.unknownSubjectCodes.length,
    malformedMarks: report.malformedMarks.slice(0, REPORT_PREVIEW_LIMIT),
    malformedMarksCount: report.malformedMarks.length,
    incompleteSubjectSets: report.incompleteSubjectSets.slice(0, REPORT_PREVIEW_LIMIT),
    unexpectedSubjectSets: report.unexpectedSubjectSets.slice(0, REPORT_PREVIEW_LIMIT)
  };
}

export type TrimmedGradeReport = ReturnType<typeof trimmedReport>;

/**
 * Upserts a GradeImportBatch by checksum (same duplicate-file protection as
 * ImportBatch), storing a size-bounded dry-run report. Status is FAILED (not
 * VALIDATED) whenever unknownSubjectCodes is non-empty - that category alone
 * hard-blocks the commit step, regardless of how many rows would otherwise
 * import cleanly.
 */
export async function saveGradeDryRunReport(input: {
  sourceFileName: string;
  sourceType: GradeImportSourceType;
  checksum: string;
  schemeChecksum: string;
  candidateDatasetChecksum: string;
  examYearId: string;
  examType: string;
  totalRows: number;
  report: ValidationReport;
  adminId: string;
  uploadId: string | null;
}) {
  return withDatabaseRetry(async () => {
    const existing = await db.gradeImportBatch.findUnique({ where: { checksum: input.checksum } });
    if (existing?.status === "IMPORTED") throw new DuplicateGradeImportError();

    const status: GradeImportStatus = input.report.unknownSubjectCodes.length > 0 ? "FAILED" : "VALIDATED";
    const rejectedRows = input.report.unmatched.length
      + input.report.seriesMismatch.length
      + input.report.duplicateInputRows.length
      + input.report.unknownSubjectCodes.length
      + input.report.malformedMarks.length;

    const data = {
      sourceFileName: input.sourceFileName,
      sourceType: input.sourceType,
      examYearId: input.examYearId,
      examType: input.examType,
      schemeChecksum: input.schemeChecksum,
      candidateDatasetChecksum: input.candidateDatasetChecksum,
      status,
      totalRows: input.totalRows,
      validatedRows: input.report.importable.length,
      rejectedRows,
      dryRunReport: jsonValue(trimmedReport(input.report)),
      adminId: input.adminId,
      uploadId: input.uploadId
    };

    return existing
      ? db.gradeImportBatch.update({
          where: { id: existing.id },
          data: { ...data, progressRows: 0, importedRows: 0, startedAt: null, completedAt: null, failureReason: null }
        })
      : db.gradeImportBatch.create({ data: { ...data, checksum: input.checksum } });
  }, "grade-import-dry-run-save", { maxAttempts: 3, timeoutMs: 30_000 });
}

export type ImportableGradeRow = { candidateId: string; subjectSchemeId: string; mark: number | null; status: GradeStatus; noteS1?: number | null; noteS2?: number | null };

/**
 * Chunked, resumable, idempotent insert - identical contract to insertCandidates
 * in lib/import-batches.ts: one short transaction per chunk (insert + progress
 * update together), skipDuplicates so a retried chunk after an ambiguous failure
 * can never double-insert, and progressRows as the resume cursor.
 */
export async function insertGradeRows(input: { batchId: string; rows: ImportableGradeRow[] }) {
  const total = input.rows.length;
  const existing = await withDatabaseRetry(
    () => db.gradeImportBatch.findUniqueOrThrow({ where: { id: input.batchId }, select: { progressRows: true, startedAt: true, examYearId: true } }),
    "grade-import-batch-progress-read",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );

  if (!existing.startedAt) {
    // Pre-check gives a clear, immediate error in the common case; the actual
    // guarantee under a genuine race is the partial unique index added in the
    // 20260730175850 migration (WHERE status = 'IMPORTING'), caught below as
    // the one deliberate exception in this codebase to preferring explicit
    // pre-checks over Prisma error codes - a pre-check alone cannot be race-safe.
    const concurrent = await withDatabaseRetry(
      () => db.gradeImportBatch.findFirst({ where: { examYearId: existing.examYearId, status: "IMPORTING", id: { not: input.batchId } }, select: { id: true } }),
      "grade-import-concurrency-precheck",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (concurrent) throw new ConcurrentGradeImportError(existing.examYearId);

    try {
      await withDatabaseRetry(
        () => db.gradeImportBatch.update({ where: { id: input.batchId }, data: { status: "IMPORTING", startedAt: new Date() } }),
        "grade-import-batch-start",
        { maxAttempts: 3, timeoutMs: 15_000 }
      );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConcurrentGradeImportError(existing.examYearId);
      throw error;
    }
  }

  const rowChunks = chunks(input.rows, INSERT_CHUNK_SIZE);
  const resumeFromChunk = Math.min(rowChunks.length, Math.floor(existing.progressRows / INSERT_CHUNK_SIZE));

  for (let index = resumeFromChunk; index < rowChunks.length; index += 1) {
    const chunkRows = rowChunks[index];
    const progressRows = Math.min(total, (index + 1) * INSERT_CHUNK_SIZE);
    await withDatabaseRetry(
      () => db.$transaction(async (tx) => {
        await tx.candidateSubjectGrade.createMany({
          data: chunkRows.map((row) => ({ candidateId: row.candidateId, subjectSchemeId: row.subjectSchemeId, mark: row.mark, status: row.status, noteS1: row.noteS1 ?? null, noteS2: row.noteS2 ?? null, sourceBatchId: input.batchId })),
          skipDuplicates: true
        });
        await tx.gradeImportBatch.update({ where: { id: input.batchId }, data: { progressRows, importedRows: progressRows } });
      }, { maxWait: 10_000, timeout: 60_000 }),
      `grade-insert-chunk-${index}`,
      { maxAttempts: 3, timeoutMs: 0, baseDelayMs: 400 }
    );
  }

  await withDatabaseRetry(
    () => db.gradeImportBatch.update({ where: { id: input.batchId }, data: { status: "IMPORTED", completedAt: new Date(), progressRows: total, importedRows: total } }),
    "grade-import-batch-finalize",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
}

export function resumeGradeEligibility(batch: { status: GradeImportStatus; uploadId: string | null }): "OK" | "ALREADY_IMPORTED" | "CANNOT_RESUME_BATCH" {
  if (batch.status === "IMPORTED") return "ALREADY_IMPORTED";
  if ((batch.status === "VALIDATED" || batch.status === "IMPORTING") && batch.uploadId) return "OK";
  return "CANNOT_RESUME_BATCH";
}

export async function markGradeBatchFailed(batchId: string, message: string) {
  await db.gradeImportBatch.update({ where: { id: batchId }, data: { status: "FAILED", failureReason: message } }).catch(() => undefined);
}

/**
 * Rollback deletes only this batch's grades (scoped by sourceBatchId, chunked so
 * a 500k-row batch is never one giant transaction) and marks the batch
 * ROLLED_BACK - it never deletes the GradeImportBatch row itself, so the audit
 * trail (who imported what, when) survives a rollback exactly like a FAILED
 * ImportBatch row is never deleted either.
 */
export async function rollbackGradeBatch(batchId: string) {
  const batch = await withDatabaseRetry(
    () => db.gradeImportBatch.findUnique({ where: { id: batchId } }),
    "grade-import-rollback-read",
    { maxAttempts: 3, timeoutMs: 12_000 }
  );
  if (!batch) throw new Error("BATCH_NOT_FOUND");
  if (batch.status === "ROLLED_BACK") return batch;

  let deletedInLastChunk = INSERT_CHUNK_SIZE;
  while (deletedInLastChunk === INSERT_CHUNK_SIZE) {
    deletedInLastChunk = await withDatabaseRetry(
      () => db.$transaction(async (tx) => {
        const targets = await tx.candidateSubjectGrade.findMany({ where: { sourceBatchId: batchId }, select: { id: true }, take: INSERT_CHUNK_SIZE });
        if (targets.length === 0) return 0;
        await tx.candidateSubjectGrade.deleteMany({ where: { id: { in: targets.map((row) => row.id) } } });
        return targets.length;
      }, { maxWait: 10_000, timeout: 60_000 }),
      "grade-import-rollback-chunk",
      { maxAttempts: 3, timeoutMs: 0, baseDelayMs: 400 }
    );
  }

  return withDatabaseRetry(
    () => db.gradeImportBatch.update({ where: { id: batchId }, data: { status: "ROLLED_BACK", completedAt: new Date() } }),
    "grade-import-rollback-finalize",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
}
