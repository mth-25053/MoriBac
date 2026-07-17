import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { authorizeMutation, apiError } from "@/lib/http";

const actionSchema = z.object({ action: z.enum(["publish", "hide", "default"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_ACTION");
  try {
    const year = await db.examYear.findUnique({ where: { id }, include: { _count: { select: { candidates: true } } } });
    if (!year) return apiError("YEAR_NOT_FOUND", 404);
    if ((parsed.data.action === "publish" || parsed.data.action === "default") && year._count.candidates === 0) return apiError("EMPTY_YEAR", 409);
    if (parsed.data.action === "publish") await db.examYear.update({ where: { id }, data: { isPublished: true } });
    if (parsed.data.action === "hide") await db.examYear.update({ where: { id }, data: { isPublished: false, isDefault: false } });
    if (parsed.data.action === "default") await db.$transaction([
      db.examYear.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      db.examYear.update({ where: { id }, data: { isDefault: true, isPublished: true } })
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseUnavailable(error, "year-update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const year = await db.examYear.findUnique({ where: { id }, select: { id: true } });
    if (!year) return apiError("YEAR_NOT_FOUND", 404);
    await db.examYear.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "year-delete");
    return apiError("YEAR_DELETE_FAILED", 500);
  }
}