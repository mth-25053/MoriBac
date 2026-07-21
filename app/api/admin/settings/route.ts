import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { settingsSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_SETTINGS");
  try {
    const keys = Object.keys(parsed.data);
    const existing = await db.setting.findMany({ where: { key: { in: keys } } });
    const previousValue = Object.fromEntries(existing.map((setting) => [setting.key, setting.value]));
    await db.$transaction(Object.entries(parsed.data).map(([key, value]) => db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })));
    await recordAudit({
      adminId: auth.session.adminId,
      action: "settings.update",
      targetType: "Setting",
      previousValue,
      newValue: parsed.data,
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseUnavailable(error, "settings-update");
  }
}
