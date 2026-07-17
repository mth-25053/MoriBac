import { randomUUID } from "node:crypto";
import { databaseErrorDetails } from "@/lib/database-retry";

export function requestId(request?: Request) {
  return request?.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
}

export function logRequest(id: string, context: string, event: string, details: Record<string, unknown> = {}) {
  console.info("[" + context + "]", { requestId: id, event, ...details });
}

export function logRequestError(id: string, context: string, event: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error("[" + context + "]", { requestId: id, event, ...databaseErrorDetails(error), ...details });
}