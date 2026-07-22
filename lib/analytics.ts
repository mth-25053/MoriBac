import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { LANGUAGE_COOKIE } from "@/lib/constants";
import { withDatabaseRetry } from "@/lib/database-retry";
import { emitAlert } from "@/lib/monitoring";
import { parseUserAgent } from "@/lib/ua-parse";

export const VISITOR_COOKIE = "mth_vid";

function geoFrom(request: Request) {
  const country = request.headers.get("x-vercel-ip-country");
  const region = request.headers.get("x-vercel-ip-country-region");
  const cityHeader = request.headers.get("x-vercel-ip-city");
  const city = cityHeader ? decodeURIComponent(cityHeader) : null;
  return { country, region, city };
}

/** Best-effort: a tracking failure must never surface to a real visitor or block the page. */
export async function recordPageView(request: Request, path: string, visitorId: string) {
  try {
    const jar = await cookies();
    const language = jar.get(LANGUAGE_COOKIE)?.value === "fr" ? "fr" : "ar";
    const { country, region, city } = geoFrom(request);
    const { browser, os, device } = parseUserAgent(request.headers.get("user-agent"));
    await withDatabaseRetry(
      () => db.pageView.create({ data: { path, visitorId, country, region, city, browser, os, device, language } }),
      "page-view-write",
      { maxAttempts: 2, timeoutMs: 6_000 }
    );
    return null;
  } catch (error) {
    emitAlert("analytics-failure", "Failed to record a page view", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Best-effort, fire-and-forget from the search route - must never add latency or break a real search. */
export function recordSearch(candidateNumber: string, year: number, found: boolean) {
  withDatabaseRetry(
    () => db.searchLog.create({ data: { candidateNumber, year, found } }),
    "search-log-write",
    { maxAttempts: 1, timeoutMs: 5_000 }
  ).catch((error) => {
    emitAlert("analytics-failure", "Failed to record a search log entry", { error: error instanceof Error ? error.message : String(error) });
  });
}

function since(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function distinctVisitorCount(where: { createdAt?: { gte: Date } } = {}) {
  const groups = await db.pageView.groupBy({ by: ["visitorId"], where });
  return groups.length;
}

export async function getVisitorStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const onlineSince = new Date(Date.now() - 5 * 60 * 1000);

  const [total, today, week, month, online] = await Promise.all([
    distinctVisitorCount(),
    distinctVisitorCount({ createdAt: { gte: startOfToday } }),
    distinctVisitorCount({ createdAt: { gte: since(7) } }),
    distinctVisitorCount({ createdAt: { gte: since(30) } }),
    distinctVisitorCount({ createdAt: { gte: onlineSince } })
  ]);
  return { total, today, week, month, online };
}

export async function getSearchStats() {
  const [total, successful, failed] = await Promise.all([
    db.searchLog.count(),
    db.searchLog.count({ where: { found: true } }),
    db.searchLog.count({ where: { found: false } })
  ]);
  return { total, successful, failed };
}

export async function getSearchesByYear() {
  const rows = await db.searchLog.groupBy({ by: ["year"], _count: { year: true }, orderBy: { _count: { year: "desc" } } });
  return rows.map((row) => ({ year: row.year, count: row._count.year }));
}

export async function getMostSearchedCandidates(limit = 10) {
  const rows = await db.searchLog.groupBy({ by: ["candidateNumber"], _count: { candidateNumber: true }, orderBy: { _count: { candidateNumber: "desc" } }, take: limit });
  return rows.map((row) => ({ candidateNumber: row.candidateNumber, count: row._count.candidateNumber }));
}

export async function getDailySearchChart(days = 30) {
  const rows = await db.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "SearchLog"
    WHERE "createdAt" >= NOW() - (${days} || ' days')::interval
    GROUP BY day
    ORDER BY day ASC
  `;
  return rows.map((row) => ({ day: row.day.toISOString().slice(0, 10), count: Number(row.count) }));
}

export async function getPeakHours() {
  const rows = await db.$queryRaw<{ hour: number; count: bigint }[]>`
    SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
    FROM "PageView"
    GROUP BY hour
    ORDER BY hour ASC
  `;
  const byHour = new Map(rows.map((row) => [row.hour, Number(row.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, count: byHour.get(hour) ?? 0 }));
}

async function topGroup(field: "country" | "region" | "city" | "browser" | "os" | "device" | "language", limit = 10) {
  const rows = await db.pageView.groupBy({
    by: [field],
    where: { [field]: { not: null } },
    _count: { [field]: true },
    orderBy: { _count: { [field]: "desc" } },
    take: limit
  });
  return rows.map((row) => ({ value: (row[field] as string | null) ?? "—", count: (row._count as Record<string, number>)[field] }));
}

export async function getVisitorBreakdowns() {
  const [countries, cities, browsers, os, devices, languages] = await Promise.all([
    topGroup("country"),
    topGroup("city"),
    topGroup("browser"),
    topGroup("os"),
    topGroup("device"),
    topGroup("language")
  ]);
  return { countries, cities, browsers, os, devices, languages };
}

export type SearchHistoryFilters = { candidateNumber?: string; year?: number; found?: boolean };

export async function getSearchHistory(filters: SearchHistoryFilters, limit = 3000) {
  const rows = await db.searchLog.findMany({
    where: {
      ...(filters.candidateNumber ? { candidateNumber: filters.candidateNumber } : {}),
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.found !== undefined ? { found: filters.found } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  const groups = new Map<string, { candidateNumber: string; year: number; lastSearchedAt: Date; found: boolean; count: number }>();
  for (const row of rows) {
    const key = `${row.candidateNumber}:${row.year}`;
    const existing = groups.get(key);
    if (existing) { existing.count += 1; continue; }
    groups.set(key, { candidateNumber: row.candidateNumber, year: row.year, lastSearchedAt: row.createdAt, found: row.found, count: 1 });
  }
  return Array.from(groups.values()).sort((a, b) => b.lastSearchedAt.getTime() - a.lastSearchedAt.getTime());
}

export async function clearSearchHistory() {
  await db.searchLog.deleteMany({});
}
