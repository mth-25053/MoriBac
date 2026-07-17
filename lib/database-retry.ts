export type DatabaseErrorDetails = {
  name: string;
  code: string;
  message: string;
  meta?: unknown;
  stack?: string;
};

const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "DB_TIMEOUT"]);

function sanitize(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://<redacted>")
    .replace(/(password=)[^&\s]+/gi, "$1<redacted>");
}

export function databaseErrorDetails(error: unknown): DatabaseErrorDetails {
  if (!(error instanceof Error)) return { name: "UnknownError", code: "UNKNOWN", message: sanitize(String(error)) };
  const record = error as Error & { code?: string; errorCode?: string; meta?: unknown };
  const rawCode = record.code || record.errorCode || "";
  const inferred = /can(?:not|'t) reach database server/i.test(error.message) ? "P1001" : /timed? out/i.test(error.message) ? "DB_TIMEOUT" : "UNKNOWN";
  return {
    name: error.name,
    code: rawCode || inferred,
    message: sanitize(error.message),
    meta: record.meta,
    stack: error.stack ? sanitize(error.stack) : undefined
  };
}

export function isRetryableDatabaseError(error: unknown) {
  const details = databaseErrorDetails(error);
  return RETRYABLE_CODES.has(details.code) || details.name === "PrismaClientInitializationError" || /connection reset|connection closed/i.test(details.message);
}

class DatabaseTimeoutError extends Error {
  readonly code = "DB_TIMEOUT";
  constructor(context: string, timeoutMs: number) {
    super(`${context} exceeded the ${timeoutMs}ms database timeout`);
    this.name = "DatabaseTimeoutError";
  }
}

async function runWithTimeout<T>(operation: () => Promise<T>, context: string, timeoutMs: number) {
  if (timeoutMs <= 0) return operation();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DatabaseTimeoutError(context, timeoutMs)), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  context: string,
  options: { maxAttempts?: number; timeoutMs?: number; baseDelayMs?: number } = {}
) {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));
  const timeoutMs = options.timeoutMs ?? 12_000;
  const baseDelayMs = options.baseDelayMs ?? 300;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runWithTimeout(operation, context, timeoutMs);
    } catch (error) {
      lastError = error;
      const retryable = isRetryableDatabaseError(error);
      const details = databaseErrorDetails(error);
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[database-retry:${context}] attempt failed`, { attempt, maxAttempts, retryable, nextDelayMs: attempt < maxAttempts && retryable ? delayMs : 0, code: details.code, name: details.name, message: details.message });
      if (!retryable || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}