import { hit } from "@/lib/sliding-window";

export type AlertKind = "database" | "stuck-batch" | "cleanup-failed" | "http-5xx" | "import-failure" | "audit-log-failure";

/**
 * Structured alert emission. Always logs a clearly tagged line (works today with
 * zero external services); additionally posts to ALERT_WEBHOOK_URL when configured,
 * so wiring a real notification channel later requires no code change here.
 */
export function emitAlert(kind: AlertKind, message: string, details: Record<string, unknown> = {}) {
  const payload = { level: "alert", kind, message, timestamp: new Date().toISOString(), ...details };
  console.error("[alert]", payload);
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;
  fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).catch((error) => {
    console.error("[alert] webhook delivery failed", { timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  });
}

const FIVE_XX_WINDOW_MS = 5 * 60 * 1000;
const FIVE_XX_THRESHOLD = 10;

/** Called from the shared apiError/databaseUnavailable chokepoints so every 5xx across every route is covered without touching each route individually. */
export function recordServerError(route: string, status: number, details: Record<string, unknown> = {}) {
  if (status < 500) return;
  const count = hit(`5xx:${route}`, FIVE_XX_WINDOW_MS);
  if (count === FIVE_XX_THRESHOLD) {
    emitAlert("http-5xx", `Repeated 5xx responses on ${route}`, { route, count, windowMs: FIVE_XX_WINDOW_MS, ...details });
  }
}
