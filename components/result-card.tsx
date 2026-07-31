import { Award, Building2, Globe2, Hash, MapPin, School, type LucideIcon } from "lucide-react";
import { classifyDecision } from "@/lib/decision";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";
import { computeBadges } from "@/lib/badges";
import type { CandidateRanks } from "@/lib/results";
import { SuccessCelebration } from "@/components/success-celebration";
import { ShareButton } from "@/components/share-button";
import { DownloadResultPdfButton } from "@/components/download-result-pdf-button";
import { SubjectGradesSection } from "@/components/subject-grades-section";

export type CandidateView = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: string;
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
  rank: number | null;
  ranks?: CandidateRanks | null;
};

const badgeToneFor: Record<"ADMIS" | "SESSIONNAIRE" | "REDOUBLE" | "ABSENT" | "ANNULE", string> = {
  ADMIS: "celebrate",
  SESSIONNAIRE: "calm",
  REDOUBLE: "calm",
  ABSENT: "calm",
  ANNULE: "cancelled"
};

/**
 * Renders "rank X out of Y" and nothing else - hides itself entirely (returns null,
 * not a placeholder) whenever either the rank or its total is unavailable, per the
 * product rule: never display null/zero/fake ranking data, only real values or nothing.
 */
function RankTile({ icon: Icon, label, rank, total, dict }: { icon: LucideIcon; label: string; rank: number | null; total: number | null; dict: Dictionary }) {
  if (rank === null || total === null) return null;
  return <div className="bg-[var(--surface)] p-5">
    <dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt>
    <dd className="mt-2 text-lg font-black"><bdi className="tabular-nums">{rank} <span className="muted text-sm font-bold">{dict.outOf} {total}</span></bdi></dd>
  </div>;
}

export function ResultCard({ candidate, dict, locale, year }: { candidate: CandidateView; dict: Dictionary; locale: Locale; year: number }) {
  const details: Array<[LucideIcon, string, string | null]> = [
    [Award, dict.series, candidate.series],
    [School, dict.school, candidate.school],
    [Building2, dict.center, candidate.examCenter],
    [MapPin, dict.wilaya, candidate.wilaya]
  ];
  const known = classifyDecision(candidate.decision);
  const celebrating = known === "ADMIS";
  const badgeTone = known ? badgeToneFor[known] : "calm";
  const decisionLabel = known ? dict.decisions[known] : candidate.decision;
  const badges = computeBadges(dict, candidate.ranks);
  const ranks = candidate.ranks;
  const showRankings = Boolean(
    ranks && ((ranks.national !== null && ranks.nationalTotal !== null) || (ranks.school !== null && ranks.schoolTotal !== null) || (ranks.examCenter !== null && ranks.examCenterTotal !== null))
  );

  return <article className={`reveal surface relative overflow-hidden${celebrating ? " glow" : ""}`} aria-labelledby="candidate-name">
    {celebrating && <SuccessCelebration />}
    <div className="relative z-[2] flex flex-col items-center gap-1 p-6 text-center sm:p-10">
      <span className="eyebrow">{dict.candidateResult}</span>
      {badges.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-2">
        {badges.map((badge) => <span key={badge.key} className="badge celebrate"><bdi>{badge.label}</bdi></span>)}
      </div>}
      <h3 id="candidate-name" className="mt-3 text-2xl font-black sm:text-3xl">{candidate.fullName}</h3>
      <p className="muted flex items-center gap-2 text-sm"><Hash size={15} />{dict.candidateNumber}: <bdi className="font-bold text-[var(--text)]">{candidate.candidateNumber}</bdi></p>

      <div className="mt-6 text-6xl font-black tabular-nums leading-none text-[var(--accent)] sm:text-7xl" dir="ltr">{formatAverage(candidate.average)}</div>

      <span className={`badge mt-5 text-base ${badgeTone}`}><bdi>{decisionLabel}</bdi></span>
      {celebrating && <p className="mt-3 text-lg font-black" style={{ color: "var(--celebrate)" }}>{dict.congratulations}</p>}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ShareButton
          dict={dict}
          locale={locale}
          fullName={candidate.fullName}
          candidateNumber={candidate.candidateNumber}
          series={candidate.series}
          wilaya={candidate.wilaya}
          average={candidate.average}
          decisionLabel={decisionLabel}
          year={year}
          badgeLabel={badges[0]?.label}
        />
        <DownloadResultPdfButton dict={dict} locale={locale} candidateNumber={candidate.candidateNumber} year={year} />
      </div>
    </div>

    <dl className="relative z-[2] grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {details.map(([Icon, label, value]) => <div key={label} className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt><dd className="mt-2 font-bold">{value || "—"}</dd></div>)}
    </dl>

    {showRankings && ranks && <div className="relative z-[2] border-t" style={{ borderColor: "var(--line)" }}>
      <p className="px-5 pt-5 text-sm font-black">{dict.rankingsResultsTitle}</p>
      <dl className="grid gap-px bg-[var(--line)] sm:grid-cols-3">
        <RankTile icon={Globe2} label={dict.rankNationalLabel} rank={ranks.national} total={ranks.nationalTotal} dict={dict} />
        <RankTile icon={School} label={dict.rankSchoolLabel} rank={ranks.school} total={ranks.schoolTotal} dict={dict} />
        <RankTile icon={Building2} label={dict.rankCenterLabel} rank={ranks.examCenter} total={ranks.examCenterTotal} dict={dict} />
      </dl>
    </div>}

    <SubjectGradesSection candidateNumber={candidate.candidateNumber} year={year} dict={dict} locale={locale} />
  </article>;
}
