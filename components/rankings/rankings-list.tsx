import { Hash } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { decisionBadgeClass, classifyDecision } from "@/lib/decision";
import { formatAverage } from "@/lib/format";
import type { RankingCandidate } from "@/components/rankings/types";

export function RankingsList({
  dict,
  candidates,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect
}: {
  dict: Dictionary;
  candidates: RankingCandidate[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (candidateNumber: string) => void;
}) {
  if (candidates.length === 0) return null;
  return <div className="mt-8">
    <div className="surface divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
      {candidates.map((candidate, index) => {
        const known = classifyDecision(candidate.decision);
        const decisionLabel = known ? dict.decisions[known] : candidate.decision;
        return <button
          key={candidate.candidateNumber}
          type="button"
          onClick={() => onSelect(candidate.candidateNumber)}
          aria-label={`${dict.viewFullResult}: ${candidate.fullName}`}
          className="rank-row stagger flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-start sm:flex-nowrap"
          style={{ borderColor: "var(--line)", ["--stagger-index" as string]: Math.min(index, 8) }}
        >
          <span className="muted flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-black tabular-nums" dir="ltr">{index + 4}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{candidate.fullName}</p>
            <p className="muted flex flex-wrap items-center gap-x-2 text-xs">
              <span className="flex items-center gap-1"><Hash size={12} /><bdi dir="ltr">{candidate.candidateNumber}</bdi></span>
              <bdi>{candidate.series}</bdi>
              {candidate.wilaya && <bdi>· {candidate.wilaya}</bdi>}
            </p>
          </div>
          <span className={`badge ${decisionBadgeClass(candidate.decision)}`}><bdi>{decisionLabel}</bdi></span>
          <span className="font-black tabular-nums text-[var(--accent)]" dir="ltr">{formatAverage(candidate.average)}</span>
        </button>;
      })}
    </div>
    {hasMore && <div className="mt-6 text-center">
      <button type="button" className="button secondary" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "…" : dict.loadMore}</button>
    </div>}
  </div>;
}
