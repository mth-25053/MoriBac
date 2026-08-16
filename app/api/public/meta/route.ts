import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";
import { getFilterOptionsCached, getPublishedYearCached } from "@/lib/results";
import { browseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isRateLimited(request, "public-meta")) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const url = new URL(request.url);
  const parsed = browseSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_FILTERS" }, { status: 400 });
  try {
    const [year, years, noticeSettings] = await Promise.all([
      getPublishedYearCached(parsed.data.year, parsed.data.session),
      db.examYear.findMany({ where: { isPublished: true }, orderBy: { year: "desc" }, select: { year: true, session: true, isDefault: true, labelAr: true, labelFr: true } }),
      db.setting.findMany({ where: { key: { in: ["siteNoticeAr", "siteNoticeFr"] } }, select: { key: true, value: true } })
    ]);
    const noticeMap = Object.fromEntries(noticeSettings.map((setting) => [setting.key, setting.value]));
    const notices = { ar: noticeMap.siteNoticeAr ?? "", fr: noticeMap.siteNoticeFr ?? "" };
    if (!year) return NextResponse.json({ year: null, session: null, labelAr: null, labelFr: null, years, notices, options: { series: [], wilayas: [], centers: [], schools: [] } });
    const options = await getFilterOptionsCached(year.id, parsed.data);
    return NextResponse.json({ year: year.year, session: year.session, labelAr: year.labelAr, labelFr: year.labelFr, years, notices, options }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    return databaseUnavailable(error, "public-meta");
  }
}