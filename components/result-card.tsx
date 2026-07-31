import { Award, Building2, Globe2, Hash, ListOrdered, MapPin, School, type LucideIcon } from "lucide-react";
import { classifyDecision } from "@/lib/decision";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";
import { computeBadges } from "@/lib/badges";
import type { CandidateRanks } from "@/lib/results";
import { SuccessCelebration } from "@/components/success-celebration";
import { ShareButton } from "@/components/share-button";
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

function RankTile({ icon: Icon, label, value, dict }: { icon: LucideIcon; label: string; value: number | null; dict: Dictionary }) {
  return <div className="bg-[var(--surface)] p-5">
    <dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt>
    <dd className="mt-2 font-black tabular-nums" dir="ltr">{value ? `#${value}` : <span className="muted font-bold" dir="auto">{dict.rankUnavailable}</span>}</dd>
  </div>;
}

export function ResultCard({ candidate, dict, locale, year }: { candidate: CandidateView; dict: Dictionary; locale: Locale; year: number }) {
  const details: Array<[LucideIcon, string, string | null]> = [
    [Award, dict.series, candidate.series],
    [MapPin, dict.wilaya, candidate.wilaya],
    [Building2, dict.center, candidate.examCenter],
    [School, dict.school, candidate.school]
  ];
  const known = classifyDecision(candidate.decision);
  const celebrating = known === "ADMIS";
  const badgeTone = known ? badgeToneFor[known] : "calm";
  const decisionLabel = known ? dict.decisions[known] : candidate.decision;
  const badges = computeBadges(dict, candidate.ranks);
  const showRankings = candidate.ranks && candidate.ranks.national !== null;

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

      <div className="mt-6">
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
      </div>
    </div>

    <dl className="relative z-[2] grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {details.map(([Icon, label, value]) => <div key={label} className="bg-[var(--surface)] p-5"><dt className="muted flex items-center gap-2 text-xs font-bold"><Icon size={15} />{label}</dt><dd className="mt-2 font-bold">{value || "—"}</dd></div>)}
    </dl>

    {showRankings && candidate.ranks && <div className="relative z-[2] border-t" style={{ borderColor: "var(--line)" }}>
      <p className="px-5 pt-5 text-sm font-black">{dict.rankingsResultsTitle}</p>
      <dl className="grid gap-px bg-[var(--line)] sm:grid-cols-3 lg:grid-cols-5">
        <RankTile icon={Globe2} label={dict.rankNationalLabel} value={candidate.ranks.national} dict={dict} />
        <RankTile icon={ListOrdered} label={dict.rankLabel} value={candidate.ranks.series} dict={dict} />
        <RankTile icon={MapPin} label={dict.rankWilayaLabel} value={candidate.ranks.wilaya} dict={dict} />
        <RankTile icon={School} label={dict.rankSchoolLabel} value={candidate.ranks.school} dict={dict} />
        <RankTile icon={Building2} label={dict.rankCenterLabel} value={candidate.ranks.examCenter} dict={dict} />
      </dl>
    </div>}

    <SubjectGradesSection candidateNumber={candidate.candidateNumber} year={year} dict={dict} locale={locale} />
  </article>;
}
