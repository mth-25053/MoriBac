import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { databaseUnavailable } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { assertSameOrigin, checkLoginThrottle, clearLoginThrottle, clientIp, recordLoginFailure } from "@/lib/security";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });
  const throttleKey = `${clientIp(request)}:${parsed.data.email}`;
  try {
    if (!(await checkLoginThrottle(throttleKey))) return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    const admin = await db.admin.findUnique({ where: { email: parsed.data.email } });
    const valid = admin
      ? await bcrypt.compare(parsed.data.password, admin.passwordHash)
      : await bcrypt.compare(parsed.data.password, "$2b$12$wJ2kHU.YG6VqKhjVlbPjxeEyr8K5TWR2JukV9HQZpH1OtjJ1qbRJa");
    if (!admin || !valid) {
      await recordLoginFailure(throttleKey);
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    await clearLoginThrottle(throttleKey);
    await createSession({ adminId: admin.id, email: admin.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseUnavailable(error, "admin-login");
  }
}