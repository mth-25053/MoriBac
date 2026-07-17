import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { authorizeMutation, apiError } from "@/lib/http";
import { settingsSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_SETTINGS");
  try {
    await db.$transaction(Object.entries(parsed.data).map(([key, value]) => db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseUnavailable(error, "settings-update");
  }
}