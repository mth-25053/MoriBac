import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { inspectExcel, parseExcel, validateExcelFile } from "@/lib/excel";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { authorizeMutation, apiError } from "@/lib/http";
import { DuplicateCandidateError, insertCandidates, markBatchFailed, resumeEligibility } from "@/lib/import-batches";
import { deleteImportUpload, loadImportUpload } from "@/lib/import-upload";
import { emitAlert } from "@/lib/monitoring";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { clientIp } from "@/lib/security";
import { importActionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = requestId(request);
  const auth = await authorizeMutation(request, reqId);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = importActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_ACTION");

  const batch = await db.importBatch.findUnique({ where: { id }, include: { examYear: { select: { year: true } } } });
  if (!batch) return apiError("BATCH_NOT_FOUND", 404);
  const eligibility = resumeEligibility(batch);
  if (eligibility !== "OK") return apiError(eligibility, 409);

  logRequest(reqId, "import-complete", "resume-started", { route: "import-complete", adminId: auth.session.adminId, batchId: id, year: batch.examYear.year });

  try {
    const stored = await loadImportUpload(batch.adminId, batch.uploadId as string);
    validateExcelFile(stored.buffer, stored.fileName, stored.mimeType);
    const inspection = await inspectExcel(stored.buffer);
    const repository = new MappingRepository();
    const resolved = await resolveMapping(inspection, null, repository);
    if (resolved.missing.length) return apiError("CANNOT_RESUME_BATCH", 409);

    const decisionMappingRepository = new DecisionMappingRepository();
    const report = await parseExcel(stored.buffer, resolved.mapping, inspection, decisionMappingRepository);
    if (report.checksum !== batch.checksum) return apiError("CANNOT_RESUME_BATCH", 409);
    if (report.invalidRows || report.unknownDecisions.length) return apiError("CANNOT_RESUME_BATCH", 409);

    await insertCandidates({ examYearId: batch.examYearId, batchId: batch.id, rows: report.rows });
    await deleteImportUpload(batch.adminId, stored.uploadId).catch(() => undefined);
    revalidateTag("published-year", "default");
    revalidateTag("filter-options", "default");
    await recordAudit({
      adminId: auth.session.adminId,
      action: "import.complete",
      targetType: "ImportBatch",
      targetId: id,
      newValue: { year: batch.examYear.year, fileName: batch.fileName, imported: report.validRows },
      ip: clientIp(request)
    });
    logRequest(reqId, "import-complete", "resume-succeeded", { route: "import-complete", adminId: auth.session.adminId, batchId: id, year: batch.examYear.year, imported: report.validRows });
    return NextResponse.json({ ok: true, imported: report.validRows });
  } catch (error) {
    logRequestError(reqId, "import-complete", "resume-failed", error, { route: "import-complete", adminId: auth.session.adminId, batchId: id, year: batch.examYear.year });
    if (error instanceof DuplicateCandidateError) {
      await markBatchFailed(batch.id, { rowNumber: 0, field: "candidateNumber", message: error.message });
      return apiError(error.message, 409);
    }
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-complete", reqId);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "CANNOT_RESUME_BATCH";
    emitAlert("import-failure", "Unexpected import completion failure", { requestId: reqId, batchId: id, adminId: auth.session.adminId, code });
    return apiError(code, 422);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = requestId(request);
  const auth = await authorizeMutation(request, reqId);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const result = await db.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id },
        include: { examYear: { select: { id: true, year: true, isPublished: true } } }
      });
      if (!batch) throw new Error("BATCH_NOT_FOUND");
      if (batch.examYear.isPublished) throw new Error("PUBLISHED_YEAR");
      const deleted = await tx.candidate.deleteMany({ where: { importBatchId: id } });
      await tx.importBatch.delete({ where: { id } });
      const [remainingBatches, remainingCandidates] = await Promise.all([
        tx.importBatch.count({ where: { examYearId: batch.examYearId } }),
        tx.candidate.count({ where: { examYearId: batch.examYearId } })
      ]);
      if (remainingBatches === 0 && remainingCandidates === 0) await tx.examYear.delete({ where: { id: batch.examYearId } });
      return { deletedCandidates: deleted.count, year: batch.examYear.year, fileName: batch.fileName };
    });
    revalidateTag("published-year", "default");
    revalidateTag("filter-options", "default");
    await recordAudit({
      adminId: auth.session.adminId,
      action: "import.undo",
      targetType: "ImportBatch",
      targetId: id,
      previousValue: { year: result.year, fileName: result.fileName },
      newValue: { deletedCandidates: result.deletedCandidates },
      ip: clientIp(request)
    });
    logRequest(reqId, "import-delete", "import-undone", { route: "import-delete", adminId: auth.session.adminId, batchId: id, year: result.year, deletedCandidates: result.deletedCandidates });
    return NextResponse.json({ ok: true, deletedCandidates: result.deletedCandidates });
  } catch (error) {
    logRequestError(reqId, "import-delete", "import-delete-failed", error, { route: "import-delete", adminId: auth.session.adminId, batchId: id });
    if (error instanceof Error && error.message === "BATCH_NOT_FOUND") return apiError("BATCH_NOT_FOUND", 404);
    if (error instanceof Error && error.message === "PUBLISHED_YEAR") return apiError("PUBLISHED_YEAR", 409);
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-delete", reqId);
    return apiError("IMPORT_DELETE_FAILED", 500);
  }
}
