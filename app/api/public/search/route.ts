import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { serializeCandidate } from "@/lib/format";
import { findCandidateResult, getPublishedYear } from "@/lib/results";
import { candidateSearchSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = candidateSearchSchema.safeParse({ number: url.searchParams.get("number") });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_NUMBER" }, { status: 400 });
  const yearValue = url.searchParams.get("year");
  const requestedYear = yearValue ? Number(yearValue) : undefined;
  if (requestedYear !== undefined && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)) return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });
  try {
    const year = await getPublishedYear(requestedYear);
    if (!year) return NextResponse.json({ candidate: null });
    const candidate = await findCandidateResult(year.id, parsed.data.number);

    return NextResponse.json({ candidate: candidate ? serializeCandidate(candidate) : null, year: year.year }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return databaseUnavailable(error, "public-search");
  }
}