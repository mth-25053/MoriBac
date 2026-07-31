import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { computeCandidateDatasetChecksum, computeSchemeChecksum } from "@/lib/grades/dataset-fingerprint";
import { DEFAULT_JSON_FIELD_MAPPING } from "@/lib/grades/default-mapping";
import { insertGradeRows, markGradeBatchFailed } from "@/lib/grades/grade-import-batches";
import { normalizeJsonRows } from "@/lib/grades/json-adapter";
import { PrismaCandidateLookup, PrismaSubjectSchemeLookup, resolveSubjectSchemeIds } from "@/lib/grades/lookups";
import { detectSourceType, validateGradeFile } from "@/lib/grades/source-file";
import { validateGradeRows } from "@/lib/grades/validate";
import { authorizeMutation, apiError } from "@/lib/http";
import { deleteImportUpload } from "@/lib/import-upload";
import { importWorkbookInput } from "@/lib/import-request";
import { emitAlert } from "@/lib/monitoring";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { clientIp } from "@/lib/security";
import { yearSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  let batchId: string | undefined;
  let uploadId: string | null = null;
  logRequest(id, "grade-import-commit", stage, { contentLength: request.headers.get("content-length") });

  const auth = await authorizeMutation(request, id);
  if ("error" in auth) return auth.error;

  try {
    stage = "request-form-read";
    const form = await request.formData();
    const parsedYear = yearSchema.safeParse({ year: form.get("year") });
    const expectedChecksum = String(form.get("checksum") || "");
    if (!parsedYear.success || !expectedChecksum) return apiError("FILE_YEAR_CHECKSUM_REQUIRED", 400, { requestId: id });

    stage = "file-input-read";
    const input = await importWorkbookInput(form, auth.session.adminId);
    uploadId = input.uploadId;
    validateGradeFile(input.buffer, input.fileName);
    const sourceType = detectSourceType(input.fileName);
    if (sourceType !== "JSON") return apiError("SOURCE_TYPE_NOT_IMPLEMENTED", 422, { requestId: id });

    stage = "checksum-check";
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    if (checksum !== expectedChecksum) return apiError("FILE_CHANGED_AFTER_PREVIEW", 409, { requestId: id });

    // Commit safety refinement: a dry run must already exist for this exact
    // file. Committing is never a one-shot "validate and import" here - only
    // /dry-run creates the batch, so we always have stored fingerprints to
    // compare freshness against, not just the file's own checksum.
    stage = "batch-lookup";
    const batch = await db.gradeImportBatch.findUnique({ where: { checksum }, include: { examYear: { select: { id: true, year: true } } } });
    if (!batch) return apiError("DRY_RUN_REQUIRED", 409, { requestId: id });
    if (batch.status === "IMPORTED") return apiError("ALREADY_IMPORTED", 409, { requestId: id });
    if (batch.status !== "VALIDATED") return apiError("DRY_RUN_REQUIRED", 409, { requestId: id });
    if (batch.examYear.year !== parsedYear.data.year) return apiError("DRY_RUN_REQUIRED", 409, { requestId: id });
    batchId = batch.id;

    stage = "staleness-check";
    const freshSchemeChecksum = await computeSchemeChecksum(batch.examYearId, batch.examType);
    if (freshSchemeChecksum !== batch.schemeChecksum) return apiError("STALE_SUBJECT_SCHEME", 409, { requestId: id });
    const freshCandidateDatasetChecksum = await computeCandidateDatasetChecksum(batch.examYearId);
    if (freshCandidateDatasetChecksum !== batch.candidateDatasetChecksum) return apiError("STALE_CANDIDATE_DATASET", 409, { requestId: id });

    stage = "file-parse";
    const rawRows = parseJsonArray(input.buffer);

    stage = "normalize";
    const { rows } = normalizeJsonRows(rawRows, DEFAULT_JSON_FIELD_MAPPING);

    stage = "validate";
    const candidateLookup = new PrismaCandidateLookup();
    const schemeLookup = new PrismaSubjectSchemeLookup();
    await candidateLookup.preload(batch.examYear.year, batch.examType, rows.map((row) => row.candidateNumber));
    const report = await validateGradeRows(rows, { candidates: candidateLookup, schemes: schemeLookup });

    // Defensive re-check: with both fingerprints unchanged this is deterministic
    // and should already be empty (the dry run already confirmed VALIDATED),
    // but never trust that without re-verifying right before writing.
    if (report.unknownSubjectCodes.length) return apiError("UNKNOWN_SUBJECT_CODES", 422, { requestId: id });

    stage = "resolve-scheme-ids";
    const subjectSchemeIds = await resolveSubjectSchemeIds(batch.examYearId, batch.examType, report.importable);
    const importableRows = report.importable.map((row, index) => ({ candidateId: row.candidateId, subjectSchemeId: subjectSchemeIds[index], mark: row.mark, status: row.status }));

    stage = "insert";
    await insertGradeRows({ batchId: batch.id, rows: importableRows });

    await recordAudit({
      adminId: auth.session.adminId,
      action: "grade-import.commit",
      targetType: "GradeImportBatch",
      targetId: batch.id,
      newValue: { year: parsedYear.data.year, fileName: input.fileName, imported: importableRows.length },
      ip: clientIp(request)
    });

    if (uploadId) {
      stage = "upload-cleanup";
      await deleteImportUpload(auth.session.adminId, uploadId).catch((error) => {
        logRequestError(id, "grade-import-commit", "upload-cleanup-failed", error, { batchId, uploadId });
      });
    }

    logRequest(id, "grade-import-commit", "import-complete", { batchId, imported: importableRows.length, elapsedMs: Date.now() - startedAt });
    return NextResponse.json({ ok: true, batchId: batch.id, imported: importableRows.length, requestId: id });
  } catch (error) {
    logRequestError(id, "grade-import-commit", "request-failed", error, { stage, batchId, elapsedMs: Date.now() - startedAt });
    if (batchId) await markGradeBatchFailed(batchId, error instanceof Error ? error.message : "IMPORT_TRANSACTION_FAILED");
    if (isDatabaseError(error)) return databaseUnavailable(error, "grade-import-commit:" + stage, id);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "IMPORT_TRANSACTION_FAILED";
    emitAlert("import-failure", "Unexpected grade import commit failure", { requestId: id, batchId, adminId: auth.session.adminId, stage, code });
    return apiError(code, 422, { requestId: id });
  }
}
