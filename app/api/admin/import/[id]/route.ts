import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { inspectExcel, parseExcel, validateExcelFile } from "@/lib/excel";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { authorizeMutation, apiError } from "@/lib/http";
import { DuplicateCandidateError, insertCandidates, markBatchFailed, resumeEligibility } from "@/lib/import-batches";
import { deleteImportUpload, loadImportUpload } from "@/lib/import-upload";
import { importActionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = importActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_ACTION");

  const batch = await db.importBatch.findUnique({ where: { id } });
  if (!batch) return apiError("BATCH_NOT_FOUND", 404);
  const eligibility = resumeEligibility(batch);
  if (eligibility !== "OK") return apiError(eligibility, 409);

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
    return NextResponse.json({ ok: true, imported: report.validRows });
  } catch (error) {
    if (error instanceof DuplicateCandidateError) {
      await markBatchFailed(batch.id, { rowNumber: 0, field: "candidateNumber", message: error.message });
      return apiError(error.message, 409);
    }
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-complete");
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "CANNOT_RESUME_BATCH";
    return apiError(code, 422);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const deletedCandidates = await db.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id },
        include: { examYear: { select: { isPublished: true } } }
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
      return deleted.count;
    });
    return NextResponse.json({ ok: true, deletedCandidates });
  } catch (error) {
    if (error instanceof Error && error.message === "BATCH_NOT_FOUND") return apiError("BATCH_NOT_FOUND", 404);
    if (error instanceof Error && error.message === "PUBLISHED_YEAR") return apiError("PUBLISHED_YEAR", 409);
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-delete");
    return apiError("IMPORT_DELETE_FAILED", 500);
  }
}
