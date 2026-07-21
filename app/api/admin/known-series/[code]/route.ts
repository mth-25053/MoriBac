import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { KnownSeriesRepository } from "@/lib/excel/known-series-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";

const repository = new KnownSeriesRepository();

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { code } = await params;
  try {
    await repository.delete(decodeURIComponent(code));
    await recordAudit({
      adminId: auth.session.adminId,
      action: "known-series.delete",
      targetType: "KnownSeries",
      targetId: code,
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "known-series-delete");
    return apiError("SERIES_NOT_FOUND", 404);
  }
}
