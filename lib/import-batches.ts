import type { ImportStatus, Prisma } from "@prisma/client";
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
  adminId: string;
  uploadId: string;
}) {
  return withDatabaseRetry(
    () => db.$transaction(async (tx) => {
      const examYear = await tx.examYear.upsert({
        where: { year: input.year },
        create: { year: input.year },
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

export async function insertCandidates(input: { examYearId: string; batchId: string; rows: ParsedCandidate[] }) {
  await db.$transaction(async (tx) => {
    for (const candidateNumbers of chunks(input.rows.map((row) => row.candidateNumber), 1000)) {
      const duplicate = await tx.candidate.findFirst({
        where: { examYearId: input.examYearId, candidateNumber: { in: candidateNumbers } },
        select: { candidateNumber: true }
      });
      if (duplicate) throw new DuplicateCandidateError(duplicate.candidateNumber);
    }
    for (const candidateRows of chunks(input.rows, 1000)) {
      await tx.candidate.createMany({
        data: candidateRows.map((row) => ({
          ...row,
          examYearId: input.examYearId,
          importBatchId: input.batchId
        }))
      });
    }
    await tx.importBatch.update({
      where: { id: input.batchId },
      data: { status: "IMPORTED", importedAt: new Date() }
    });
  }, { maxWait: 10_000, timeout: 300_000 });
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