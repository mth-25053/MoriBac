import { KnownSeriesManager } from "@/components/admin/known-series-manager";
import { db } from "@/lib/db";
import { adminDictionary } from "@/lib/admin-i18n";
import { getLocale } from "@/lib/i18n";

export default async function SeriesPage() {
  const dict = adminDictionary(await getLocale());
  const series = await db.knownSeries.findMany({ orderBy: { code: "asc" } });
  return <div>
    <span className="eyebrow">{dict.knownSeriesNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.knownSeriesNav}</h1>
    <KnownSeriesManager dict={dict} series={series.map((row) => ({ code: row.code, createdAt: row.createdAt.toISOString() }))} />
  </div>;
}
