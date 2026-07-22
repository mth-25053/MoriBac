import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import {
  getDailySearchChart,
  getMostSearchedCandidates,
  getPeakHours,
  getSearchesByYear,
  getSearchStats,
  getVisitorBreakdowns,
  getVisitorStats
} from "@/lib/analytics";
import { adminDictionary } from "@/lib/admin-i18n";
import { getLocale } from "@/lib/i18n";

export default async function AnalyticsPage() {
  const dict = adminDictionary(await getLocale());
  const [visitors, searches, searchesByYear, mostSearchedCandidates, dailySearchChart, peakHours, breakdowns] = await Promise.all([
    getVisitorStats(),
    getSearchStats(),
    getSearchesByYear(),
    getMostSearchedCandidates(10),
    getDailySearchChart(30),
    getPeakHours(),
    getVisitorBreakdowns()
  ]);

  return <div>
    <span className="eyebrow">{dict.analyticsNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.analyticsNav}</h1>
    <div className="mt-7">
      <AnalyticsDashboard
        dict={dict}
        data={{
          visitors,
          searches,
          searchesByYear,
          mostSearchedCandidates,
          dailySearchChart,
          peakHours,
          countries: breakdowns.countries,
          cities: breakdowns.cities,
          browsers: breakdowns.browsers,
          os: breakdowns.os,
          devices: breakdowns.devices,
          languages: breakdowns.languages
        }}
      />
    </div>
  </div>;
}
