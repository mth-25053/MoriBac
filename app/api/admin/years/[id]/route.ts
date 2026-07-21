import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { authorizeMutation, apiError } from "@/lib/http";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";
import { clientIp } from "@/lib/security";

const actionSchema = z.object({ action: z.enum(["publish", "hide", "default"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = requestId(request);
  const auth = await authorizeMutation(request, reqId);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_ACTION");
  try {
    const year = await db.examYear.findUnique({ where: { id }, include: { _count: { select: { candidates: true } } } });
    if (!year) return apiError("YEAR_NOT_FOUND", 404);
    if ((parsed.data.action === "publish" || parsed.data.action === "default") && year._count.candidates === 0) return apiError("EMPTY_YEAR", 409);
    const previousValue = { isPublished: year.isPublished, isDefault: year.isDefault };
    if (parsed.data.action === "publish") await db.examYear.update({ where: { id }, data: { isPublished: true } });
    if (parsed.data.action === "hide") await db.examYear.update({ where: { id }, data: { isPublished: false, isDefault: false } });
    if (parsed.data.action === "default") await db.$transaction([
      db.examYear.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      db.examYear.update({ where: { id }, data: { isDefault: true, isPublished: true } })
    ]);
    revalidateTag("published-year", "default");
    revalidateTag("filter-options", "default");
    await recordAudit({
      adminId: auth.session.adminId,
      action: `year.${parsed.data.action}`,
      targetType: "ExamYear",
      targetId: id,
      previousValue,
      newValue: { action: parsed.data.action },
      ip: clientIp(request)
    });
    logRequest(reqId, "year-update", "year-action-applied", { route: "year-update", adminId: auth.session.adminId, year: year.year, action: parsed.data.action });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRequestError(reqId, "year-update", "year-action-failed", error, { route: "year-update", adminId: auth.session.adminId });
    return databaseUnavailable(error, "year-update", reqId);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = requestId(request);
  const auth = await authorizeMutation(request, reqId);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const year = await db.examYear.findUnique({ where: { id }, select: { id: true, year: true, isPublished: true, isDefault: true } });
    if (!year) return apiError("YEAR_NOT_FOUND", 404);
    await db.examYear.delete({ where: { id } });
    revalidateTag("published-year", "default");
    revalidateTag("filter-options", "default");
    await recordAudit({
      adminId: auth.session.adminId,
      action: "year.delete",
      targetType: "ExamYear",
      targetId: id,
      previousValue: { year: year.year, isPublished: year.isPublished, isDefault: year.isDefault },
      newValue: null,
      ip: clientIp(request)
    });
    logRequest(reqId, "year-delete", "year-deleted", { route: "year-delete", adminId: auth.session.adminId, year: year.year });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRequestError(reqId, "year-delete", "year-delete-failed", error, { route: "year-delete", adminId: auth.session.adminId });
    if (isDatabaseError(error)) return databaseUnavailable(error, "year-delete", reqId);
    return apiError("YEAR_DELETE_FAILED", 500);
  }
}
