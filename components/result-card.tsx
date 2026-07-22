import { Award, Building2, Hash, ListOrdered, MapPin, School, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";
import { SuccessCelebration } from "@/components/success-celebration";

export type CandidateView = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: "ADMIS" | "SESSIONNAIRE" | "REDOUBLE" | "ABSENT" | "ANNULE";
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
  rank: number | null;
};

const badgeToneFor: Record<CandidateView["decision"], string> = {
  ADMIS: "celebrate",
  SESSIONNAIRE: "calm",
  REDOUBLE: "calm",
  ABSENT: "calm",
  ANNULE: "cancelled"
};

export function ResultCard({ candidate, dict }: { candidate: CandidateView; dict: Dictionary }) {
  const details: Array<[LucideIcon, string, string | null]> = [
    [Award, dict.series, candidate.series],
    [MapPin, dict.wilaya, candidate.wilaya],
    [Building2, dict.center, candidate.examCenter],
    [School, dict.school, candidate.school]
  ];
  const celebrating = candidate.decision === "ADMIS";
  const badgeTone = badgeToneFor[candidate.decision];

  return <article className={`reveal surface relative overflow-hidden${celebrating ? " glow" : ""}`} aria-labelledby="candidate-name">
    {celebrating && <SuccessCelebration />}
    <div className="relative z-[2] flex flex-col items-center gap-1 p-6 text-center sm:p-10">
      <span className="eyebrow">{dict.candidateResult}</span>
      <h3 id="candidate-name" className="mt-3 text-2xl font-black sm:text-3xl">{candidate.fullName}</h3>
      <p className="muted flex items-center gap-2 text-sm"><Hash size={15} />{dict.candidateNumber}: <bdi className="font-bold text-[var(--text)]">{candidate.candidateNumber}</bdi></p>

      <div className="mt-6 text-6xl font-black tabular-nums leading-none text-[var(--accent)] sm:text-7xl" dir="ltr">{formatAverage(candidate.average)}</div>

      <span className={`badge mt-5 text-base ${badgeTone}`}>{dict.decisions[candidate.decision]}</span>
      {celebrating && <p className="mt-3 text-lg font-black" style={{ color: "var(--celebrate)" }}>{dict.congratulations}</p>}
    </div>

    <dl className="relative z-[2] grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {details.map(([Icon, label, value]) => <div key={label} className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt><dd className="mt-2 font-bold">{value || "—"}</dd></div>)}
      {candidate.rank && <div className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><ListOrdered size={15} />{dict.rankLabel}</dt><dd className="mt-2 font-bold tabular-nums" dir="ltr">#{candidate.rank}</dd></div>}
    </dl>
  </article>;
}
