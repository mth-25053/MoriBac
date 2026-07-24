import type { Dictionary } from "@/lib/i18n";
import type { RankingStatistics } from "@/components/rankings/types";

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="surface p-4 text-center sm:p-5">
    <div className="text-2xl font-black tabular-nums sm:text-3xl" style={accent ? { color: accent } : undefined}>{value}</div>
    <div className="muted mt-1.5 text-xs font-bold">{label}</div>
  </div>;
}

export function RankingsStats({ dict, statistics }: { dict: Dictionary; statistics: RankingStatistics }) {
  return <div className="stagger mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
    <StatTile label={dict.statTotal} value={statistics.total.toLocaleString()} />
    <StatTile label={dict.statPassed} value={statistics.passed.toLocaleString()} accent="var(--accent)" />
    <StatTile label={dict.statFailed} value={statistics.failed.toLocaleString()} />
    <StatTile label={dict.statResit} value={statistics.session.toLocaleString()} />
    <StatTile label={dict.statCancelled} value={statistics.cancelled.toLocaleString()} />
    <StatTile label={dict.statAbsent} value={statistics.absent.toLocaleString()} />
    <StatTile label={dict.statSuccessRate} value={`${statistics.successRate.toFixed(1)}%`} accent="var(--accent)" />
    <StatTile label={dict.statHighest} value={statistics.highest.toFixed(2)} accent="var(--accent)" />
    <StatTile label={dict.statLowest} value={statistics.lowest.toFixed(2)} />
  </div>;
}
