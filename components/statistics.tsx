import type { Dictionary } from "@/lib/i18n";

export type Stats = { total:number; passed:number; session:number; failed:number; highest:number; successRate:number };
export function Statistics({ stats, dict }: { stats: Stats; dict: Dictionary }) {
  const values = [[dict.totalCandidates,stats.total],[dict.totalPassed,stats.passed],[dict.sessionCandidates,stats.session],[dict.failedCandidates,stats.failed],[dict.highestAverage,stats.highest.toFixed(2)],[dict.successRate,`${stats.successRate.toFixed(1)}%`]];
  return <section className="grid grid-cols-2 gap-3 lg:grid-cols-6" aria-label={dict.totalCandidates}>{values.map(([label,value])=><div className="rounded-xl border bg-[var(--surface)] p-4" style={{borderColor:"var(--line)"}} key={label}><div className="text-2xl font-black tabular-nums">{value}</div><div className="muted mt-1 text-xs font-bold">{label}</div></div>)}</section>;
}
