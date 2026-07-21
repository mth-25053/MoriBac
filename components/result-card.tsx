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

function outcomeMessage(decision: CandidateView["decision"], dict: Dictionary) {
  if (decision === "ADMIS") return dict.congratulations;
  if (decision === "SESSIONNAIRE") return dict.sessionnaireMessage;
  if (decision === "ANNULE") return dict.annuleNote;
  return dict.notAdmittedMessage;
}

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
    <div className="relative z-[2] flex flex-col justify-between gap-5 border-b p-6 sm:p-8 md:flex-row md:items-center" style={{ borderColor: "var(--line)" }}>
      <div>
        <span className="eyebrow">{dict.candidateResult}</span>
        <h3 id="candidate-name" className="mt-2 text-2xl font-black sm:text-3xl">{candidate.fullName}</h3>
        <p className="muted mt-2 flex items-center gap-2"><Hash size={16} />{dict.candidateNumber}: <bdi className="font-bold text-[var(--text)]">{candidate.candidateNumber}</bdi></p>
      </div>
      <div className="md:text-end">
        <div className="text-5xl font-black tabular-nums text-[var(--accent)]" dir="ltr">{formatAverage(candidate.average)}</div>
        <span className={`badge mt-3 ${badgeTone}`}>{dict.decisions[candidate.decision]}</span>
      </div>
    </div>
    <p className="relative z-[2] p-6 text-lg font-bold leading-8 sm:p-8" style={{ color: celebrating ? "var(--celebrate)" : "var(--text)" }}>{outcomeMessage(candidate.decision, dict)}</p>
    <dl className="relative z-[2] grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {details.map(([Icon, label, value]) => <div key={label} className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt><dd className="mt-2 font-bold">{value || "—"}</dd></div>)}
      {candidate.rank && <div className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><ListOrdered size={15} />{dict.rankLabel}</dt><dd className="mt-2 font-bold tabular-nums" dir="ltr">#{candidate.rank}</dd></div>}
    </dl>
  </article>;
}
