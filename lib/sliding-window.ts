type Window = { count: number; windowStart: number };

const windows = new Map<string, Window>();

/**
 * In-memory, per-instance sliding-window counter. Resets on cold start and is not
 * shared across serverless instances - a documented, accepted limitation given no
 * external store (Redis/KV) is provisioned. Still meaningfully blunts single-source
 * bursts within a warm instance without adding load to the database.
 */
export function hit(key: string, windowMs: number): number {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.windowStart >= windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return 1;
  }
  current.count += 1;
  return current.count;
}

export function peek(key: string, windowMs: number): number {
  const current = windows.get(key);
  if (!current || Date.now() - current.windowStart >= windowMs) return 0;
  return current.count;
}

export function resetAll() {
  windows.clear();
}
