import { NextResponse } from "next/server";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { inspectExcel, parseExcel, parseMappingJson, validateExcelFile } from "@/lib/excel";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { deleteImportUpload } from "@/lib/import-upload";
import { importWorkbookInput } from "@/lib/import-request";
import { DuplicateCandidateError, DuplicateImportError, errorSummary, insertCandidates, markBatchFailed, saveValidationReport } from "@/lib/import-batches";
import { authorizeMutation, apiError } from "@/lib/http";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { yearSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const id = requestId(request);
  const startedAt = Date.now();
  let batchId: string | undefined;
  let stage = "request-started";
  let uploadId: string | null = null;
  logRequest(id, "import-commit", stage, {
    contentLength: request.headers.get("content-length"),
    contentType: request.headers.get("content-type")
  });

  const auth = await authorizeMutation(request, id);
  if ("error" in auth) return auth.error;

  try {
    stage = "request-form-read";
    const form = await request.formData();
    const parsedYear = yearSchema.safeParse({ year: form.get("year") });
    const expectedChecksum = String(form.get("checksum") || "");
    if (!parsedYear.success || !expectedChecksum) return apiError("FILE_YEAR_CHECKSUM_REQUIRED", 400, { requestId: id });

    stage = "workbook-input-read";
    const input = await importWorkbookInput(form, auth.session.adminId);
    uploadId = input.uploadId;
    logRequest(id, "import-commit", "workbook-received", {
      source: input.source,
      bytes: input.buffer.length,
      contentType: input.mimeType
    });

    stage = "workbook-validation";
    validateExcelFile(input.buffer, input.fileName, input.mimeType);
    const inspection = await inspectExcel(input.buffer);
    const repository = new MappingRepository();

    stage = "mapping-read";
    const resolved = await resolveMapping(inspection, parseMappingJson(form.get("mapping")), repository);
    if (resolved.missing.length) return apiError("MAPPING_REQUIRED", 409, { missingRequired: resolved.missing, requestId: id });

    stage = "workbook-parse";
    const decisionMappingRepository = new DecisionMappingRepository();
    const report = await parseExcel(input.buffer, resolved.mapping, inspection, decisionMappingRepository);
    if (report.checksum !== expectedChecksum) return apiError("FILE_CHANGED_AFTER_PREVIEW", 409, { requestId: id });

    stage = "unknown-decision-check";
    if (report.unknownDecisions.length) {
      await decisionMappingRepository.recordUnknown(report.unknownDecisions);
      return apiError("UNKNOWN_DECISIONS_REQUIRE_MAPPING", 409, { unknownDecisions: report.unknownDecisions, requestId: id });
    }

    stage = "mapping-save";
    await repository.save(inspection, resolved.mapping);
    stage = "preview-validation-save";
    const validation = await saveValidationReport({
      report,
      fileName: input.fileName,
      year: parsedYear.data.year,
      adminId: auth.session.adminId,
      uploadId: input.uploadId
    });
    batchId = validation.batch.id;
    if (report.invalidRows) {
      return apiError("IMPORT_HAS_INVALID_ROWS", 422, {
        batchId,
        errors: errorSummary(report),
        errorCount: report.errors.length,
        requestId: id
      });
    }

    stage = "candidate-import-transaction";
    await insertCandidates({ examYearId: validation.examYear.id, batchId: validation.batch.id, rows: report.rows });

    if (uploadId) {
      stage = "upload-cleanup";
      await deleteImportUpload(auth.session.adminId, uploadId).catch((error) => {
        logRequestError(id, "import-commit", "upload-cleanup-failed", error, { uploadId });
      });
    }
    logRequest(id, "import-commit", "import-complete", {
      source: input.source,
      imported: report.validRows,
      elapsedMs: Date.now() - startedAt
    });
    return NextResponse.json({ ok: true, batchId, imported: report.validRows, requestId: id });
  } catch (error) {
    logRequestError(id, "import-commit", "request-failed", error, {
      stage,
      batchId,
      elapsedMs: Date.now() - startedAt
    });
    if (error instanceof DuplicateImportError) return apiError("DUPLICATE_FILE", 409, { requestId: id });
    if (batchId) {
      const message = error instanceof DuplicateCandidateError ? error.message : "IMPORT_TRANSACTION_FAILED";
      await markBatchFailed(batchId, {
        rowNumber: 0,
        field: error instanceof DuplicateCandidateError ? "candidateNumber" : undefined,
        message
      });
      if (error instanceof DuplicateCandidateError) return apiError(message, 409, { requestId: id });
    }
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-commit:" + stage, id);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INVALID_EXCEL_FILE";
    return apiError(code, 422, { requestId: id });
  }
}