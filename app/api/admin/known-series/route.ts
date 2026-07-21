import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable } from "@/lib/database-errors";
import { KnownSeriesRepository } from "@/lib/excel/known-series-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { knownSeriesCreateSchema } from "@/lib/validation";

const repository = new KnownSeriesRepository();

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const parsed = knownSeriesCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_SERIES");
  try {
    const series = await repository.add(parsed.data.code);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "known-series.add",
      targetType: "KnownSeries",
      targetId: series.code,
      newValue: { code: series.code },
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, series });
  } catch (error) {
    return databaseUnavailable(error, "known-series-create");
  }
}
