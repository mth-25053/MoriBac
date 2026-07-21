import { clientIp } from "@/lib/security";
import { hit } from "@/lib/sliding-window";

const DEFAULT_LIMIT = 120;
const DEFAULT_WINDOW_MS = 60_000;

/** In-memory, per-instance rate limit keyed by client IP + route. See lib/sliding-window.ts for the documented multi-instance limitation. */
export function isRateLimited(request: Request, route: string, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
  const key = `rate-limit:${route}:${clientIp(request)}`;
  return hit(key, windowMs) > limit;
}
