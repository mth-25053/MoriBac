import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { isRateLimited } from "@/lib/rate-limit";
import { browseResultsCached, getPublishedYearCached } from "@/lib/results";
import { browseSchema } from "@/lib/validation";

export async function GET(request: Request) {
  if (isRateLimited(request, "public-results")) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const url = new URL(request.url);
  const parsed = browseSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_FILTERS" }, { status: 400 });
  try {
    const year = await getPublishedYearCached(parsed.data.year);
    if (!year) return NextResponse.json({ candidates: [], total: 0, pageCount: 0, statistics: null });
    const data = await browseResultsCached(year.id, parsed.data);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return databaseUnavailable(error, "public-results");
  }
}