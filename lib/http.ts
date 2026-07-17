import { NextResponse } from "next/server";
import { readSession, validateCsrf } from "@/lib/auth";
import { databaseUnavailable } from "@/lib/database-errors";
import { withDatabaseRetry } from "@/lib/database-retry";
import { db } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function authorizeMutation(request: Request) {
  const session = await readSession();
  if (!session) return { error: apiError("UNAUTHORIZED", 401) } as const;
  if (!assertSameOrigin(request) || !(await validateCsrf(request))) return { error: apiError("INVALID_REQUEST_TOKEN", 403) } as const;
  try {
    const admin = await withDatabaseRetry(
      () => db.admin.findUnique({ where: { id: session.adminId }, select: { id: true } }),
      "admin-authorization",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (!admin) return { error: apiError("UNAUTHORIZED", 401) } as const;
  } catch (error) {
    return { error: databaseUnavailable(error, "admin-authorization") } as const;
  }
  return { session } as const;
}