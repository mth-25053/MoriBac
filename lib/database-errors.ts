import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseErrorDetails } from "@/lib/database-retry";
import { emitAlert, recordServerError } from "@/lib/monitoring";

export function isDatabaseError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const details = databaseErrorDetails(error);
  return /^P\d{4}$/.test(details.code) || details.code === "DB_TIMEOUT" || details.name.startsWith("Prisma") || details.name === "DatabaseTimeoutError";
}

export function databaseUnavailable(error: unknown, context: string, existingRequestId?: string) {
  const requestId = existingRequestId || randomUUID();
  const details = databaseErrorDetails(error);
  const schemaError = details.code === "P2021" || details.code === "P2022";
  const status = schemaError ? 500 : 503;
  const code = schemaError ? "DATABASE_SCHEMA_ERROR" : "DATABASE_CONNECTION_FAILED";
  console.error(`[${context}] Database operation failed`, { requestId, timestamp: new Date().toISOString(), route: context, ...details });
  emitAlert("database", `Database operation failed in ${context}`, { requestId, route: context, code: details.code, name: details.name });
  recordServerError(context, status);
  return NextResponse.json({
    error: code,
    message: schemaError
      ? "The database schema is not ready. Verify pending migrations."
      : "The database connection failed after three bounded attempts. Retry this action.",
    retryable: !schemaError,
    requestId
  }, { status, headers: { "Cache-Control": "no-store" } });
}