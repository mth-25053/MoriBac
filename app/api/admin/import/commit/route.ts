import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { inspectExcel, parseExcel, parseMappingJson, validateExcelFile } from "@/lib/excel";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { chunks, DuplicateImportError, errorSummary, markBatchFailed, saveValidationReport } from "@/lib/import-batches";
import { authorizeMutation, apiError } from "@/lib/http";
import { yearSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const form = await request.formData();
  const file = form.get("file");
  const parsedYear = yearSchema.safeParse({ year: form.get("year") });
  const expectedChecksum = String(form.get("checksum") || "");
  if (!(file instanceof File) || !parsedYear.success || !expectedChecksum) return apiError("FILE_YEAR_CHECKSUM_REQUIRED");

  let batchId: string | undefined;
  let databaseStage = "not-started";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    validateExcelFile(buffer, file.name, file.type);
    const inspection = await inspectExcel(buffer);
    const repository = new MappingRepository();
    databaseStage = "mapping-read";
    const resolved = await resolveMapping(inspection, parseMappingJson(form.get("mapping")), repository);
    if (resolved.missing.length) return apiError("MAPPING_REQUIRED", 409, { missingRequired: resolved.missing });
    const report = await parseExcel(buffer, resolved.mapping, inspection);
    if (report.checksum !== expectedChecksum) return apiError("FILE_CHANGED_AFTER_PREVIEW", 409);
    databaseStage = "mapping-save";
    await repository.save(inspection, resolved.mapping);
    databaseStage = "preview-validation-save";
    const validation = await saveValidationReport({ report, fileName: file.name, year: parsedYear.data.year, adminId: auth.session.adminId });
    batchId = validation.batch.id;
    if (report.invalidRows) return apiError("IMPORT_HAS_INVALID_ROWS", 422, { batchId, errors: errorSummary(report), errorCount: report.errors.length });

    databaseStage = "candidate-import-transaction";
    await db.$transaction(async (tx) => {
      for (const candidateNumbers of chunks(report.rows.map((row) => row.candidateNumber), 1000)) {
        const duplicate = await tx.candidate.findFirst({
          where: { examYearId: validation.examYear.id, candidateNumber: { in: candidateNumbers } },
          select: { candidateNumber: true }
        });
        if (duplicate) throw new Error(`DUPLICATE_CANDIDATE:${duplicate.candidateNumber}`);
      }
      for (const candidateRows of chunks(report.rows, 1000)) {
        await tx.candidate.createMany({
          data: candidateRows.map((row) => ({ ...row, examYearId: validation.examYear.id, importBatchId: validation.batch.id }))
        });
      }
      await tx.importBatch.update({ where: { id: validation.batch.id }, data: { status: "IMPORTED", importedAt: new Date() } });
    }, { maxWait: 10_000, timeout: 300_000 });

    return NextResponse.json({ ok: true, batchId, imported: report.validRows });
  } catch (error) {
    if (error instanceof DuplicateImportError) return apiError("DUPLICATE_FILE", 409);
    if (batchId) {
      const message = error instanceof Error && error.message.startsWith("DUPLICATE_CANDIDATE:") ? error.message : "IMPORT_TRANSACTION_FAILED";
      await markBatchFailed(batchId, { rowNumber: 0, field: message.startsWith("DUPLICATE_CANDIDATE:") ? "candidateNumber" : undefined, message });
      if (message.startsWith("DUPLICATE_CANDIDATE:")) return apiError(message, 409);
    }
    if (isDatabaseError(error)) return databaseUnavailable(error, `import-commit:${databaseStage}`);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INVALID_EXCEL_FILE";
    return apiError(code, 422);
  }
}