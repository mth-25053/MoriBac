import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { browseResults, getPublishedYear } from "@/lib/results";
import { browseSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = browseSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_FILTERS" }, { status: 400 });
  try {
    const year = await getPublishedYear(parsed.data.year);
    if (!year) return NextResponse.json({ candidates: [], total: 0, pageCount: 0, statistics: null });
    const data = await browseResults(year.id, parsed.data);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return databaseUnavailable(error, "public-results");
  }
}