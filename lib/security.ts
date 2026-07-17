import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function checkLoginThrottle(key: string) {
  const record = await db.loginThrottle.findUnique({ where: { key } });
  return !record?.blockedUntil || record.blockedUntil <= new Date();
}

export async function recordLoginFailure(key: string) {
  const now = new Date();
  const record = await db.loginThrottle.findUnique({ where: { key } });
  if (!record || now.getTime() - record.windowStart.getTime() > WINDOW_MS) {
    await db.loginThrottle.upsert({ where: { key }, create: { key, attempts: 1, windowStart: now }, update: { attempts: 1, windowStart: now, blockedUntil: null } });
    return;
  }
  const attempts = record.attempts + 1;
  await db.loginThrottle.update({ where: { key }, data: { attempts, blockedUntil: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : null } });
}

export async function clearLoginThrottle(key: string) {
  await db.loginThrottle.deleteMany({ where: { key } });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
