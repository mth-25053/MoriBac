import type { ExamSession, ImportStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import type { ImportReport, ParsedCandidate, RowError } from "@/lib/excel";

export class DuplicateImportError extends Error {
  constructor() {
    super("DUPLICATE_FILE");
    this.name = "DuplicateImportError";
  }
}

export class DuplicateCandidateError extends Error {
  constructor(readonly candidateNumber: string) {
    super("DUPLICATE_CANDIDATE:" + candidateNumber);
    this.name = "DuplicateCandidateError";
  }
}

export function assertBatchCanBeValidated(existing: { status: ImportStatus; examYearId: string } | null, examYearId: string) {
  if (existing?.status === "IMPORTED" || (existing && existing.examYearId !== examYearId)) throw new DuplicateImportError();
}

export function resumeEligibility(batch: { status: ImportStatus; uploadId: string | null }): "OK" | "ALREADY_IMPORTED" | "CANNOT_RESUME_BATCH" {
  if (batch.status === "IMPORTED") return "ALREADY_IMPORTED";
  if (batch.status === "FAILED" || !batch.uploadId) return "CANNOT_RESUME_BATCH";
  return "OK";
}

function jsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value ? JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue : undefined;
}

export async function saveValidationReport(input: {
  report: ImportReport;
  fileName: string;
  year: number;
  session?: ExamSession;
  adminId: string;
  uploadId: string;
}) {
  const session = input.session ?? "NORMAL";
  return withDatabaseRetry(
    () => db.$transaction(async (tx) => {
      const examYear = await tx.examYear.upsert({
        where: { year_session: { year: input.year, session } },
        create: { year: input.year, session },
        update: {}
      });
      const existing = await tx.importBatch.findUnique({ where: { checksum: input.report.checksum } });
      assertBatchCanBeValidated(existing, examYear.id);
      const status: ImportStatus = input.report.invalidRows > 0 ? "FAILED" : "VALIDATED";
      const batch = existing
        ? await tx.importBatch.update({
            where: { id: existing.id },
            data: {
              fileName: input.fileName,
              status,
              totalRows: input.report.totalRows,
              validRows: input.report.validRows,
              invalidRows: input.report.invalidRows,
              importedAt: null,
              adminId: input.adminId,
              uploadId: input.uploadId
            }
          })
        : await tx.importBatch.create({
            data: {
              fileName: input.fileName,
              checksum: input.report.checksum,
              status,
              totalRows: input.report.totalRows,
              validRows: input.report.validRows,
              invalidRows: input.report.invalidRows,
              adminId: input.adminId,
              examYearId: examYear.id,
              uploadId: input.uploadId
            }
          });
      await tx.importError.deleteMany({ where: { importBatchId: batch.id } });
      if (input.report.errors.length) {
        await tx.importError.createMany({
          data: input.report.errors.map((error) => ({
            importBatchId: batch.id,
            rowNumber: error.rowNumber,
            field: error.field,
            message: error.message,
            rawData: jsonValue(error.rawData)
          }))
        });
      }
      return { batch, examYear };
    }, { maxWait: 10_000, timeout: 60_000 }),
    "import-validation-save",
    { maxAttempts: 3, timeoutMs: 0, baseDelayMs: 400 }
  );
}

/**
 * Kept fixed across attempts: resuming relies on rowsImported always landing on an exact
 * multiple of this size (or the final total), so it can be turned straight back into a
 * chunk index. Never change this without also migrating in-flight batches' rowsImported.
 */
const INSERT_CHUNK_SIZE = 2000;

/**
 * Inserts candidate rows in short, independently-committed chunks instead of one giant
 * transaction, so a large (tens of thousands of rows) import is:
 *  - resumable: if the process is interrupted partway, calling this again with the same
 *    rows picks up from importBatch.rowsImported instead of redoing already-committed chunks;
 *  - idempotent under retry: each chunk uses createMany({ skipDuplicates: true }), so a chunk
 *    that is retried after an ambiguous failure (e.g. the response was lost but the write
 *    landed) can never create duplicate candidate rows - the unique (examYearId, candidateNumber)
 *    constraint silently absorbs the re-attempt;
 *  - observable: rowsImported is updated in the same transaction as each chunk's insert, so a
 *    concurrent progress poll always sees a durably-committed count, never a mid-chunk value.
 *
 * A one-time preflight still rejects a genuine conflict: a candidate number already present
 * in this exam year under a DIFFERENT batch. A collision under THIS batch's own id is expected
 * on resume and is left to skipDuplicates, not treated as an error.
 */
export async function insertCandidates(input: { examYearId: string; batchId: string; rows: ParsedCandidate[] }) {
  for (const candidateNumbers of chunks(input.rows.map((row) => row.candidateNumber), 1000)) {
    const duplicate = await withDatabaseRetry(
      () => db.candidate.findFirst({
        where: { examYearId: input.examYearId, candidateNumber: { in: candidateNumbers }, importBatchId: { not: input.batchId } },
        select: { candidateNumber: true }
      }),
      "candidate-duplicate-check",
      { maxAttempts: 3, timeoutMs: 30_000 }
    );
    if (duplicate) throw new DuplicateCandidateError(duplicate.candidateNumber);
  }

  const total = input.rows.length;
  const existing = await withDatabaseRetry(
    () => db.importBatch.findUniqueOrThrow({ where: { id: input.batchId }, select: { rowsImported: true } }),
    "import-batch-progress-read",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
  const rowChunks = chunks(input.rows, INSERT_CHUNK_SIZE);
  const resumeFromChunk = Math.min(rowChunks.length, Math.floor(existing.rowsImported / INSERT_CHUNK_SIZE));

  for (let index = resumeFromChunk; index < rowChunks.length; index += 1) {
    const chunkRows = rowChunks[index];
    const rowsImported = Math.min(total, (index + 1) * INSERT_CHUNK_SIZE);
    await withDatabaseRetry(
      () => db.$transaction(async (tx) => {
        await tx.candidate.createMany({
          data: chunkRows.map((row) => ({ ...row, examYearId: input.examYearId, importBatchId: input.batchId })),
          skipDuplicates: true
        });
        await tx.importBatch.update({ where: { id: input.batchId }, data: { rowsImported } });
      }, { maxWait: 10_000, timeout: 60_000 }),
      `candidate-insert-chunk-${index}`,
      { maxAttempts: 3, timeoutMs: 0, baseDelayMs: 400 }
    );
  }

  await withDatabaseRetry(
    () => db.importBatch.update({ where: { id: input.batchId }, data: { status: "IMPORTED", importedAt: new Date(), rowsImported: total } }),
    "import-batch-finalize",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
}

export async function markBatchFailed(batchId: string, error: RowError) {
  await db.$transaction([
    db.importBatch.update({ where: { id: batchId }, data: { status: "FAILED", importedAt: null } }),
    db.importError.create({ data: { importBatchId: batchId, rowNumber: error.rowNumber, field: error.field, message: error.message, rawData: jsonValue(error.rawData) } })
  ]).catch(() => undefined);
}

export function errorSummary(report: ImportReport) {
  return report.errors.slice(0, 100).map(({ rowNumber, field, message }) => ({ rowNumber, field, message }));
}

export function chunks<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}