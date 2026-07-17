import { Award, Building2, Hash, MapPin, School, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";
import { decisionBadgeClass } from "@/lib/decision";

export type CandidateView = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: "ADMIS" | "SESSIONNAIRE" | "REDOUBLE" | "ABSENT" | "ANNULE";
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
};

export function ResultCard({ candidate, dict }: { candidate: CandidateView; dict: Dictionary }) {
  const details: Array<[LucideIcon, string, string | null]> = [
    [Award, dict.series, candidate.series],
    [MapPin, dict.wilaya, candidate.wilaya],
    [Building2, dict.center, candidate.examCenter],
    [School, dict.school, candidate.school]
  ];
  return <article className="surface overflow-hidden" aria-labelledby="candidate-name">
    <div className="flex flex-col justify-between gap-5 border-b p-5 md:flex-row md:items-center md:p-7" style={{ borderColor: "var(--line)" }}>
      <div><span className="eyebrow">{dict.candidateResult}</span><h3 id="candidate-name" className="mt-2 text-2xl font-black">{candidate.fullName}</h3><p className="muted mt-2 flex items-center gap-2"><Hash size={16} />{dict.candidateNumber}: <bdi className="font-bold text-[var(--text)]">{candidate.candidateNumber}</bdi></p></div>
      <div className="md:text-end"><div className="text-4xl font-black tabular-nums text-[var(--accent)]" dir="ltr">{formatAverage(candidate.average)}</div><span className={`badge mt-2 ${decisionBadgeClass(candidate.decision)}`}>{dict.decisions[candidate.decision]}</span></div>
    </div>
    <dl className="grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {details.map(([Icon, label, value]) => <div key={label} className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt><dd className="mt-2 font-bold">{value || "—"}</dd></div>)}
    </dl>
  </article>;
}