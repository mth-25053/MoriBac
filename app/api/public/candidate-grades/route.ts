import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { getCandidateSubjectGrades } from "@/lib/grades/public-grades";
import { isRateLimited } from "@/lib/rate-limit";
import { getPublishedYearCached } from "@/lib/results";
import { candidateSearchSchema, examSessionSchema } from "@/lib/validation";

export async function GET(request: Request) {
  if (isRateLimited(request, "public-candidate-grades")) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const url = new URL(request.url);
  const parsed = candidateSearchSchema.safeParse({ number: url.searchParams.get("number") });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_NUMBER" }, { status: 400 });
  const yearValue = url.searchParams.get("year");
  const requestedYear = yearValue ? Number(yearValue) : undefined;
  if (requestedYear !== undefined && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)) return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });
  const parsedSession = examSessionSchema.safeParse(url.searchParams.get("session") ?? undefined);
  if (!parsedSession.success) return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 });
  try {
    const year = await getPublishedYearCached(requestedYear, parsedSession.data);
    if (!year) return NextResponse.json({ grades: [] });
    const grades = await getCandidateSubjectGrades(year.id, parsed.data.number);
    return NextResponse.json(
      { grades: grades ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    return databaseUnavailable(error, "public-candidate-grades");
  }
}
