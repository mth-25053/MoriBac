import { SearchHistoryTable } from "@/components/admin/search-history-table";
import { getSearchHistory } from "@/lib/analytics";
import { adminDictionary } from "@/lib/admin-i18n";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function SearchHistoryPage({ searchParams }: { searchParams: Promise<{ number?: string; year?: string; found?: string }> }) {
  const dict = adminDictionary(await getLocale());
  const params = await searchParams;

  const filters = {
    candidateNumber: params.number?.trim() || undefined,
    year: params.year ? Number(params.year) : undefined,
    found: params.found === "yes" ? true : params.found === "no" ? false : undefined
  };

  const [history, years] = await Promise.all([
    getSearchHistory(filters),
    db.examYear.findMany({ orderBy: { year: "desc" }, select: { year: true } })
  ]);

  const rows = history.slice(0, 200).map((row) => ({
    candidateNumber: row.candidateNumber,
    year: row.year,
    lastSearchedAt: row.lastSearchedAt.toISOString(),
    found: row.found,
    count: row.count
  }));

  return <div>
    <span className="eyebrow">{dict.searchHistoryNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.searchHistoryNav}</h1>
    <div className="mt-7"><SearchHistoryTable rows={rows} years={years.map((y) => y.year)} dict={dict} /></div>
  </div>;
}
