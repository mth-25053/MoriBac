import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { authorizeMutation, apiError } from "@/lib/http";

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
