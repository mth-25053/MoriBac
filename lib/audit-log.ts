import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import { emitAlert } from "@/lib/monitoring";

export type AuditEntry = {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
};

function json(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/** Best-effort: a failure to record an audit entry must never break the admin action it's attached to. */
export async function recordAudit(entry: AuditEntry) {
  try {
    await withDatabaseRetry(
      () => db.auditLog.create({
        data: {
          adminId: entry.adminId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          previousValue: json(entry.previousValue),
          newValue: json(entry.newValue),
          ip: entry.ip ?? null
        }
      }),
      "audit-log-write",
      { maxAttempts: 2, timeoutMs: 8_000 }
    );
  } catch (error) {
    emitAlert("audit-log-failure", "Failed to record an audit log entry", {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
