import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { inspectExcel, parseExcel, parseMappingJson, validateExcelFile } from "@/lib/excel";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { importWorkbookInput } from "@/lib/import-request";
import { DuplicateImportError, errorSummary, saveValidationReport } from "@/lib/import-batches";
import { authorizeMutation, apiError } from "@/lib/http";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { yearSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const id = requestId(request);
  const startedAt = Date.now();
  let stage = "request-started";
  logRequest(id, "import-preview", stage, {
    contentLength: request.headers.get("content-length"),
    contentType: request.headers.get("content-type")
  });

  const auth = await authorizeMutation(request, id);
  if ("error" in auth) return auth.error;

  try {
    stage = "request-form-read";
    const form = await request.formData();
    const parsedYear = yearSchema.safeParse({ year: form.get("year") });
    if (!parsedYear.success) return apiError("FILE_AND_YEAR_REQUIRED", 400, { requestId: id });

    stage = "workbook-input-read";
    const input = await importWorkbookInput(form, auth.session.adminId);
    logRequest(id, "import-preview", "workbook-received", {
      source: input.source,
      bytes: input.buffer.length,
      contentType: input.mimeType
    });

    stage = "workbook-validation";
    validateExcelFile(input.buffer, input.fileName, input.mimeType);
    const inspection = await inspectExcel(input.buffer);
    const provided = parseMappingJson(form.get("mapping"));
    const repository = new MappingRepository();

    stage = "mapping-read";
    const resolved = await resolveMapping(inspection, provided, repository);
    if (resolved.missing.length) {
      logRequest(id, "import-preview", "mapping-required", {
        source: input.source,
        headerRow: inspection.headerRow,
        columnCount: inspection.columns.length,
        elapsedMs: Date.now() - startedAt
      });
      return NextResponse.json({
        mappingRequired: true,
        checksum: createHash("sha256").update(input.buffer).digest("hex"),
        sheetName: inspection.sheetName,
        headerRow: inspection.headerRow,
        structureKey: inspection.structureKey,
        columns: inspection.columns,
        mapping: resolved.mapping,
        missingRequired: resolved.missing,
        requestId: id
      });
    }

    stage = "workbook-parse";
    const decisionMappingRepository = new DecisionMappingRepository();
    const report = await parseExcel(input.buffer, resolved.mapping, inspection, decisionMappingRepository);
    stage = "mapping-save";
    await repository.save(inspection, resolved.mapping);

    stage = "unknown-decision-check";
    if (report.unknownDecisions.length) {
      await decisionMappingRepository.recordUnknown(report.unknownDecisions);
      logRequest(id, "import-preview", "unknown-decisions-required", {
        source: input.source,
        unknownDecisionCount: report.unknownDecisions.length,
        elapsedMs: Date.now() - startedAt
      });
      return NextResponse.json({
        mappingRequired: false,
        unknownDecisionsRequired: true,
        unknownDecisions: report.unknownDecisions,
        checksum: report.checksum,
        requestId: id
      });
    }

    stage = "preview-validation-save";
    const { batch } = await saveValidationReport({
      report,
      fileName: input.fileName,
      year: parsedYear.data.year,
      adminId: auth.session.adminId,
      uploadId: input.uploadId
    });
    logRequest(id, "import-preview", "preview-ready", {
      source: input.source,
      totalRows: report.totalRows,
      validRows: report.validRows,
      invalidRows: report.invalidRows,
      elapsedMs: Date.now() - startedAt
    });
    return NextResponse.json({
      mappingRequired: false,
      unknownDecisionsRequired: false,
      mappingSource: resolved.source,
      mapping: resolved.mapping,
      sheetName: inspection.sheetName,
      headerRow: inspection.headerRow,
      batchId: batch.id,
      status: batch.status,
      checksum: report.checksum,
      totalRows: report.totalRows,
      validRows: report.validRows,
      invalidRows: report.invalidRows,
      preview: report.preview,
      errors: errorSummary(report),
      errorCount: report.errors.length,
      requestId: id
    });
  } catch (error) {
    logRequestError(id, "import-preview", "request-failed", error, {
      stage,
      elapsedMs: Date.now() - startedAt
    });
    if (error instanceof DuplicateImportError) return apiError("DUPLICATE_FILE", 409, { requestId: id });
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-preview:" + stage, id);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INVALID_EXCEL_FILE";
    return apiError(code, 422, { requestId: id });
  }
}