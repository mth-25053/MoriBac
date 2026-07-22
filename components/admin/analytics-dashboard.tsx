import type { AdminDictionary } from "@/lib/admin-i18n";

type CountRow = { value: string; count: number };
type YearRow = { year: number; count: number };
type CandidateRow = { candidateNumber: string; count: number };
type DayRow = { day: string; count: number };
type HourRow = { hour: number; count: number };

export type AnalyticsData = {
  visitors: { total: number; today: number; week: number; month: number; online: number };
  searches: { total: number; successful: number; failed: number };
  searchesByYear: YearRow[];
  mostSearchedCandidates: CandidateRow[];
  dailySearchChart: DayRow[];
  peakHours: HourRow[];
  countries: CountRow[];
  cities: CountRow[];
  browsers: CountRow[];
  os: CountRow[];
  devices: CountRow[];
  languages: CountRow[];
};

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="surface p-6">
    <div className="text-4xl font-black tabular-nums text-[var(--accent)]">{value.toLocaleString()}</div>
    <div className="muted mt-2 font-bold">{label}</div>
  </div>;
}

function BarList({ title, rows, noData }: { title: string; rows: CountRow[]; noData: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <section className="surface p-6">
    <h2 className="font-black">{title}</h2>
    {rows.length === 0 ? <p className="muted mt-3 text-sm">{noData}</p> : <ul className="mt-4 space-y-3">
      {rows.map((row) => <li key={row.value}>
        <div className="flex items-center justify-between text-sm font-bold"><bdi>{row.value}</bdi><span className="tabular-nums">{row.count.toLocaleString()}</span></div>
        <div className="mt-1 h-2 rounded-full bg-[var(--surface-2)]"><div className="h-2 rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: "var(--accent)" }} /></div>
      </li>)}
    </ul>}
  </section>;
}

function DailyChart({ title, rows, noData }: { title: string; rows: DayRow[]; noData: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <section className="surface p-6">
    <h2 className="font-black">{title}</h2>
    {rows.length === 0 ? <p className="muted mt-3 text-sm">{noData}</p> : <div className="mt-5 flex h-32 items-end gap-1 overflow-x-auto">
      {rows.map((row) => <div key={row.day} className="flex min-w-4 flex-1 flex-col items-center gap-1" title={`${row.day}: ${row.count}`}>
        <div className="w-full rounded-t" style={{ height: `${Math.max(4, (row.count / max) * 100)}%`, background: "var(--accent)" }} />
      </div>)}
    </div>}
  </section>;
}

function HourChart({ title, rows, noData }: { title: string; rows: HourRow[]; noData: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const hasData = rows.some((row) => row.count > 0);
  return <section className="surface p-6">
    <h2 className="font-black">{title}</h2>
    {!hasData ? <p className="muted mt-3 text-sm">{noData}</p> : <div className="mt-5 flex h-32 items-end gap-1">
      {rows.map((row) => <div key={row.hour} className="flex flex-1 flex-col items-center gap-1" title={`${row.hour}h: ${row.count}`}>
        <div className="w-full rounded-t" style={{ height: `${Math.max(4, (row.count / max) * 100)}%`, background: "var(--celebrate)" }} />
      </div>)}
    </div>}
  </section>;
}

export function AnalyticsDashboard({ data, dict }: { data: AnalyticsData; dict: AdminDictionary }) {
  const yearRows = data.searchesByYear.map((row) => ({ value: `BAC ${row.year}`, count: row.count }));
  const candidateRows = data.mostSearchedCandidates.map((row) => ({ value: row.candidateNumber, count: row.count }));

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label={dict.totalVisitors} value={data.visitors.total} />
      <StatCard label={dict.todayVisitors} value={data.visitors.today} />
      <StatCard label={dict.weekVisitors} value={data.visitors.week} />
      <StatCard label={dict.monthVisitors} value={data.visitors.month} />
      <StatCard label={dict.onlineVisitors} value={data.visitors.online} />
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label={dict.totalSearches} value={data.searches.total} />
      <StatCard label={dict.successfulSearches} value={data.searches.successful} />
      <StatCard label={dict.failedSearches} value={data.searches.failed} />
    </div>

    <DailyChart title={dict.dailySearchChart} rows={data.dailySearchChart} noData={dict.noData} />

    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title={dict.searchesByYear} rows={yearRows} noData={dict.noData} />
      <BarList title={dict.mostSearchedCandidates} rows={candidateRows} noData={dict.noData} />
    </div>

    <HourChart title={dict.peakHours} rows={data.peakHours} noData={dict.noData} />

    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title={dict.visitorCountries} rows={data.countries} noData={dict.noData} />
      <BarList title={dict.visitorCities} rows={data.cities} noData={dict.noData} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BarList title={dict.browserStats} rows={data.browsers} noData={dict.noData} />
      <BarList title={dict.osStats} rows={data.os} noData={dict.noData} />
      <BarList title={dict.deviceStats} rows={data.devices} noData={dict.noData} />
      <BarList title={dict.languageStats} rows={data.languages} noData={dict.noData} />
    </div>
  </div>;
}
