import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { isRateLimited } from "@/lib/rate-limit";
import { getPublishedYearCached, searchCandidatesByName } from "@/lib/results";
import { candidateNameSearchSchema, examSessionSchema } from "@/lib/validation";

export async function GET(request: Request) {
  if (isRateLimited(request, "public-search-name")) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const url = new URL(request.url);
  const parsed = candidateNameSearchSchema.safeParse({ query: url.searchParams.get("query") });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  const yearValue = url.searchParams.get("year");
  const requestedYear = yearValue ? Number(yearValue) : undefined;
  if (requestedYear !== undefined && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)) return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });
  const parsedSession = examSessionSchema.safeParse(url.searchParams.get("session") ?? undefined);
  if (!parsedSession.success) return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 });
  try {
    const year = await getPublishedYearCached(requestedYear, parsedSession.data);
    if (!year) return NextResponse.json({ candidates: [], hasMore: false, year: null });
    const result = await searchCandidatesByName(year.id, parsed.data.query);
    return NextResponse.json(
      { ...result, year: year.year, session: year.session },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
    );
  } catch (error) {
    return databaseUnavailable(error, "public-search-name");
  }
}
