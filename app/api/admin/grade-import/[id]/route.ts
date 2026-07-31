import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { DEFAULT_JSON_FIELD_MAPPING } from "@/lib/grades/default-mapping";
import { insertGradeRows, markGradeBatchFailed, resumeGradeEligibility, rollbackGradeBatch } from "@/lib/grades/grade-import-batches";
import { normalizeJsonRows } from "@/lib/grades/json-adapter";
import { PrismaCandidateLookup, PrismaSubjectSchemeLookup, resolveSubjectSchemeIds } from "@/lib/grades/lookups";
import { validateGradeFile } from "@/lib/grades/source-file";
import { validateGradeRows } from "@/lib/grades/validate";
import { authorizeMutation, apiError } from "@/lib/http";
import { loadImportUpload } from "@/lib/import-upload";
import { emitAlert } from "@/lib/monitoring";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { clientIp } from "@/lib/security";
import { importActionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Lightweight progress poll for a large in-flight or resumable grade import - never touches the file or the DB write path. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const batch = await db.gradeImportBatch.findUnique({
      where: { id },
      select: { status: true, validatedRows: true, progressRows: true }
    });
    if (!batch) return apiError("BATCH_NOT_FOUND", 404);
    return NextResponse.json({
      status: batch.status,
      totalRows: batch.validatedRows,
      rowsImported: batch.status === "IMPORTED" ? batch.validatedRows : batch.progressRows
    });
  } catch (error) {
    return databaseUnavailable(error, "grade-import-progress");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = requestId(request);
  const auth = await authorizeMutation(request, reqId);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = importActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_ACTION");

  const batch = await db.gradeImportBatch.findUnique({ where: { id }, include: { examYear: { select: { id: true, year: true } } } });
  if (!batch) return apiError("BATCH_NOT_FOUND", 404);
  const eligibility = resumeGradeEligibility(batch);
  if (eligibility !== "OK") return apiError(eligibility, 409);

  logRequest(reqId, "grade-import-resume", "resume-started", { batchId: id, year: batch.examYear.year });

  try {
    const stored = await loadImportUpload(batch.adminId, batch.uploadId as string);
    validateGradeFile(stored.buffer, stored.fileName);

    let rawRows: unknown[];
    try {
      const parsedJson = JSON.parse(stored.buffer.toString("utf8"));
      if (!Array.isArray(parsedJson)) throw new Error("not an array");
      rawRows = parsedJson;
    } catch {
      return apiError("CANNOT_RESUME_BATCH", 409);
    }

    const { rows } = normalizeJsonRows(rawRows, DEFAULT_JSON_FIELD_MAPPING);
    const candidateLookup = new PrismaCandidateLookup();
    const schemeLookup = new PrismaSubjectSchemeLookup();
    await candidateLookup.preload(batch.examYear.year, batch.examType, rows.map((row) => row.candidateNumber));
    const report = await validateGradeRows(rows, { candidates: candidateLookup, schemes: schemeLookup });

    if (report.unknownSubjectCodes.length) return apiError("CANNOT_RESUME_BATCH", 409);

    const subjectSchemeIds = await resolveSubjectSchemeIds(batch.examYear.id, batch.examType, report.importable);
    const importableRows = report.importable.map((row, index) => ({ candidateId: row.candidateId, subjectSchemeId: subjectSchemeIds[index], mark: row.mark, status: row.status }));

    await insertGradeRows({ batchId: batch.id, rows: importableRows });
    await recordAudit({
      adminId: auth.session.adminId,
      action: "grade-import.resume",
      targetType: "GradeImportBatch",
      targetId: id,
      newValue: { year: batch.examYear.year, fileName: batch.sourceFileName, imported: importableRows.length },
      ip: clientIp(request)
    });
    logRequest(reqId, "grade-import-resume", "resume-succeeded", { batchId: id, imported: importableRows.length });
    return NextResponse.json({ ok: true, imported: importableRows.length });
  } catch (error) {
    logRequestError(reqId, "grade-import-resume", "resume-failed", error, { batchId: id });
    if (isDatabaseError(error)) return databaseUnavailable(error, "grade-import-resume", reqId);
    await markGradeBatchFailed(batch.id, error instanceof Error ? error.message : "CANNOT_RESUME_BATCH");
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "CANNOT_RESUME_BATCH";
    emitAlert("import-failure", "Unexpected grade import resume failure", { requestId: reqId, batchId: id, adminId: auth.session.adminId, code });
    return apiError(code, 422);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = requestId(request);
  const auth = await authorizeMutation(request, reqId);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const before = await db.gradeImportBatch.findUnique({ where: { id }, select: { status: true, sourceFileName: true, examYear: { select: { year: true } } } });
    if (!before) return apiError("BATCH_NOT_FOUND", 404);
    const rolledBack = await rollbackGradeBatch(id);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "grade-import.rollback",
      targetType: "GradeImportBatch",
      targetId: id,
      previousValue: { status: before.status, fileName: before.sourceFileName, year: before.examYear.year },
      newValue: { status: rolledBack.status },
      ip: clientIp(request)
    });
    logRequest(reqId, "grade-import-rollback", "rollback-complete", { batchId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRequestError(reqId, "grade-import-rollback", "rollback-failed", error, { batchId: id });
    if (error instanceof Error && error.message === "BATCH_NOT_FOUND") return apiError("BATCH_NOT_FOUND", 404);
    if (isDatabaseError(error)) return databaseUnavailable(error, "grade-import-rollback", reqId);
    return apiError("ROLLBACK_FAILED", 500);
  }
}
