import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { computeCandidateDatasetChecksum, computeSchemeChecksum } from "@/lib/grades/dataset-fingerprint";
import { DEFAULT_JSON_FIELD_MAPPING } from "@/lib/grades/default-mapping";
import { DuplicateGradeImportError, saveGradeDryRunReport } from "@/lib/grades/grade-import-batches";
import { normalizeJsonRows } from "@/lib/grades/json-adapter";
import { PrismaCandidateLookup, PrismaSubjectSchemeLookup } from "@/lib/grades/lookups";
import { detectSourceType, validateGradeFile } from "@/lib/grades/source-file";
import { validateGradeRows } from "@/lib/grades/validate";
import { authorizeMutation, apiError } from "@/lib/http";
import { importWorkbookInput } from "@/lib/import-request";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { yearSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXAM_TYPE = "bac";

function parseJsonArray(buffer: Buffer) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON_FILE");
  }
  if (!Array.isArray(parsed)) throw new Error("INVALID_JSON_FILE");
  return parsed;
}

export async function POST(request: Request) {
  const id = requestId(request);
  const startedAt = Date.now();
  let stage = "request-started";
  logRequest(id, "grade-import-dry-run", stage, { contentLength: request.headers.get("content-length") });

  const auth = await authorizeMutation(request, id);
  if ("error" in auth) return auth.error;

  try {
    stage = "request-form-read";
    const form = await request.formData();
    const parsedYear = yearSchema.safeParse({ year: form.get("year") });
    if (!parsedYear.success) return apiError("FILE_AND_YEAR_REQUIRED", 400, { requestId: id });

    stage = "file-input-read";
    const input = await importWorkbookInput(form, auth.session.adminId);
    validateGradeFile(input.buffer, input.fileName);
    const sourceType = detectSourceType(input.fileName);
    if (sourceType !== "JSON") return apiError("SOURCE_TYPE_NOT_IMPLEMENTED", 422, { requestId: id });

    stage = "file-parse";
    const rawRows = parseJsonArray(input.buffer);

    stage = "normalize";
    const { rows, malformed } = normalizeJsonRows(rawRows, DEFAULT_JSON_FIELD_MAPPING);

    stage = "exam-year-resolve";
    const examYear = await db.examYear.upsert({ where: { year_session: { year: parsedYear.data.year, session: "NORMAL" } }, create: { year: parsedYear.data.year }, update: {} });

    stage = "validate";
    const candidateLookup = new PrismaCandidateLookup();
    const schemeLookup = new PrismaSubjectSchemeLookup();
    await candidateLookup.preload(parsedYear.data.year, EXAM_TYPE, rows.map((row) => row.candidateNumber));
    const report = await validateGradeRows(rows, { candidates: candidateLookup, schemes: schemeLookup });

    stage = "fingerprint";
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    const schemeChecksum = await computeSchemeChecksum(examYear.id, EXAM_TYPE);
    const candidateDatasetChecksum = await computeCandidateDatasetChecksum(examYear.id);

    stage = "save-report";
    const batch = await saveGradeDryRunReport({
      sourceFileName: input.fileName,
      sourceType,
      checksum,
      schemeChecksum,
      candidateDatasetChecksum,
      examYearId: examYear.id,
      examType: EXAM_TYPE,
      totalRows: rawRows.length,
      report,
      adminId: auth.session.adminId,
      uploadId: input.uploadId
    });

    // Exact counts required by the Dry Run report: graded (numeric mark),
    // exempt (valid row, no numeric mark - e.g. EP exemption), and rejected
    // (every true-rejection category combined). Exempt rows are never part of
    // rejectedRowCount - they will be imported, same as graded rows.
    const gradedRowCount = report.importable.filter((row) => row.status === "GRADED").length;
    const exemptRowCount = report.importable.filter((row) => row.status === "EXEMPT").length;
    const rejectedRowCount = report.unmatched.length + report.seriesMismatch.length + report.duplicateInputRows.length + report.unknownSubjectCodes.length + report.malformedMarks.length;

    logRequest(id, "grade-import-dry-run", "dry-run-complete", {
      batchId: batch.id,
      status: batch.status,
      totalRows: rawRows.length,
      importable: report.importable.length,
      graded: gradedRowCount,
      exempt: exemptRowCount,
      rejected: rejectedRowCount,
      elapsedMs: Date.now() - startedAt
    });

    return NextResponse.json({
      batchId: batch.id,
      status: batch.status,
      checksum,
      totalRows: rawRows.length,
      malformedRowCount: malformed.length,
      malformedRows: malformed.slice(0, 200),
      importableCount: report.importable.length,
      gradedRowCount,
      exemptRowCount,
      rejectedRowCount,
      unmatched: report.unmatched.slice(0, 200),
      unmatchedCount: report.unmatched.length,
      seriesMismatch: report.seriesMismatch.slice(0, 200),
      seriesMismatchCount: report.seriesMismatch.length,
      duplicateInputRows: report.duplicateInputRows.slice(0, 200),
      duplicateInputRowsCount: report.duplicateInputRows.length,
      unknownSubjectCodes: report.unknownSubjectCodes.slice(0, 200),
      unknownSubjectCodesCount: report.unknownSubjectCodes.length,
      malformedMarks: report.malformedMarks.slice(0, 200),
      malformedMarksCount: report.malformedMarks.length,
      incompleteSubjectSets: report.incompleteSubjectSets.slice(0, 200),
      unexpectedSubjectSets: report.unexpectedSubjectSets.slice(0, 200),
      requestId: id
    });
  } catch (error) {
    logRequestError(id, "grade-import-dry-run", "request-failed", error, { stage, elapsedMs: Date.now() - startedAt });
    if (error instanceof DuplicateGradeImportError) return apiError("DUPLICATE_FILE", 409, { requestId: id });
    if (isDatabaseError(error)) return databaseUnavailable(error, "grade-import-dry-run:" + stage, id);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INVALID_GRADE_FILE";
    return apiError(code, 422, { requestId: id });
  }
}
