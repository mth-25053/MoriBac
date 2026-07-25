import type { Dictionary } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";
import type { RankingCandidate } from "@/components/rankings/types";

function PodiumCard({ dict, candidate, place, index, onSelect }: { dict: Dictionary; candidate: RankingCandidate; place: "gold" | "silver" | "bronze"; index: number; onSelect: (candidateNumber: string) => void }) {
  const medalLabel = place === "gold" ? dict.rankFirst : place === "silver" ? dict.rankSecond : dict.rankThird;
  return <button
    type="button"
    onClick={() => onSelect(candidate.candidateNumber)}
    aria-label={`${dict.viewFullResult}: ${candidate.fullName}`}
    className={`podium-card ${place} surface stagger flex w-full flex-col items-center gap-2 p-5 text-center transition-transform hover:-translate-y-1 active:translate-y-0${place === "gold" ? " sm:-translate-y-3" : ""}`}
    style={{ ["--stagger-index" as string]: index }}
  >
    <span className={`medal ${place}`} aria-hidden="true">{medalLabel.split(" ")[0]}</span>
    <p className="font-black">{candidate.fullName}</p>
    <p className="text-2xl font-black tabular-nums text-[var(--accent)]" dir="ltr">{formatAverage(candidate.average)}</p>
    <p className="muted text-xs font-bold"><bdi>{candidate.series}</bdi>{candidate.wilaya ? ` · ${candidate.wilaya}` : ""}</p>
  </button>;
}

export function RankingsPodium({
  dict,
  candidates,
  onSelect
}: {
  dict: Dictionary;
  candidates: RankingCandidate[];
  onSelect: (candidateNumber: string) => void;
}) {
  if (candidates.length === 0) return null;

  return <div className="podium-grid mt-8 grid gap-4 sm:grid-cols-3">
    <PodiumCard dict={dict} candidate={candidates[0]} place="gold" index={0} onSelect={onSelect} />
    {candidates[1] && <PodiumCard dict={dict} candidate={candidates[1]} place="silver" index={1} onSelect={onSelect} />}
    {candidates[2] && <PodiumCard dict={dict} candidate={candidates[2]} place="bronze" index={2} onSelect={onSelect} />}
  </div>;
}
