import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { inspectExcel, parseExcel, parseMappingJson, validateExcelFile } from "@/lib/excel";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { DuplicateImportError, errorSummary, saveValidationReport } from "@/lib/import-batches";
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
  if (!(file instanceof File) || !parsedYear.success) return apiError("FILE_AND_YEAR_REQUIRED");

  let databaseStage = "not-started";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    validateExcelFile(buffer, file.name, file.type);
    const inspection = await inspectExcel(buffer);
    const provided = parseMappingJson(form.get("mapping"));
    const repository = new MappingRepository();
    databaseStage = "mapping-read";
    const resolved = await resolveMapping(inspection, provided, repository);
    if (resolved.missing.length) {
      return NextResponse.json({
        mappingRequired: true,
        checksum: createHash("sha256").update(buffer).digest("hex"),
        sheetName: inspection.sheetName,
        headerRow: inspection.headerRow,
        structureKey: inspection.structureKey,
        columns: inspection.columns,
        mapping: resolved.mapping,
        missingRequired: resolved.missing
      });
    }

    const report = await parseExcel(buffer, resolved.mapping, inspection);
    databaseStage = "mapping-save";
    await repository.save(inspection, resolved.mapping);
    databaseStage = "preview-validation-save";
    const { batch } = await saveValidationReport({ report, fileName: file.name, year: parsedYear.data.year, adminId: auth.session.adminId });
    return NextResponse.json({
      mappingRequired: false,
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
      errorCount: report.errors.length
    });
  } catch (error) {
    if (error instanceof DuplicateImportError) return apiError("DUPLICATE_FILE", 409);
    if (isDatabaseError(error)) return databaseUnavailable(error, `import-preview:${databaseStage}`);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INVALID_EXCEL_FILE";
    return apiError(code, 422);
  }
}