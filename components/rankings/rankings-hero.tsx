import { Award, MapPin, School, Trophy } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";
import type { RankingCandidate, RankingsScope } from "@/components/rankings/types";

function championLabel(dict: Dictionary, scope: RankingsScope, series: string, wilaya: string, school: string, examCenter: string) {
  if (scope === "school") return `${dict.topOfSchool} ${school}`;
  if (scope === "center") return `${dict.topOfCenter} ${examCenter}`;
  if (scope === "wilaya") return `${dict.championOfWilaya} ${wilaya}`;
  if (scope === "series") return `${dict.championOfSeries} ${series}`;
  return dict.nationalChampion;
}

const PODIUM_ORDER: Record<"gold" | "silver" | "bronze", string> = { gold: "order-1 sm:order-2", silver: "order-2 sm:order-1", bronze: "order-3" };

function PodiumCard({ dict, candidate, place, index }: { dict: Dictionary; candidate: RankingCandidate; place: "gold" | "silver" | "bronze"; index: number }) {
  const medalLabel = place === "gold" ? dict.rankFirst : place === "silver" ? dict.rankSecond : dict.rankThird;
  return <article className={`podium-card surface stagger flex flex-col items-center gap-2 p-5 text-center ${PODIUM_ORDER[place]}${place === "gold" ? " sm:-translate-y-3" : ""}`} style={{ ["--stagger-index" as string]: index }}>
    <span className={`medal ${place}`} aria-hidden="true">{medalLabel.split(" ")[0]}</span>
    <p className="font-black">{candidate.fullName}</p>
    <p className="text-2xl font-black tabular-nums text-[var(--accent)]" dir="ltr">{formatAverage(candidate.average)}</p>
    <p className="muted text-xs font-bold"><bdi>{candidate.series}</bdi>{candidate.wilaya ? ` · ${candidate.wilaya}` : ""}</p>
  </article>;
}

export function RankingsHero({
  dict,
  candidates,
  scope,
  series,
  wilaya,
  school,
  examCenter
}: {
  dict: Dictionary;
  candidates: RankingCandidate[];
  scope: RankingsScope;
  series: string;
  wilaya: string;
  school: string;
  examCenter: string;
}) {
  const champion = candidates[0];
  if (!champion) return null;
  const label = championLabel(dict, scope, series, wilaya, school, examCenter);

  return <div className="mt-10">
    <article className="glow surface reveal relative overflow-hidden p-6 text-center sm:p-10">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl text-white" style={{ background: "var(--celebrate)" }}><Trophy size={28} /></span>
      <span className="eyebrow mt-4 block" style={{ color: "var(--celebrate)" }}>{label}</span>
      <h3 className="mt-2 text-2xl font-black sm:text-3xl">{champion.fullName}</h3>
      <div className="mt-4 text-5xl font-black tabular-nums leading-none text-[var(--accent)] sm:text-6xl" dir="ltr">{formatAverage(champion.average)}</div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-bold">
        <span className="muted flex items-center gap-1.5"><Award size={15} /><bdi>{champion.series}</bdi></span>
        {champion.wilaya && <span className="muted flex items-center gap-1.5"><MapPin size={15} /><bdi>{champion.wilaya}</bdi></span>}
        {champion.school && <span className="muted flex items-center gap-1.5"><School size={15} /><bdi>{champion.school}</bdi></span>}
      </div>
    </article>

    {candidates.length > 1 && <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <PodiumCard dict={dict} candidate={candidates[0]} place="gold" index={0} />
      {candidates[1] && <PodiumCard dict={dict} candidate={candidates[1]} place="silver" index={1} />}
      {candidates[2] && <PodiumCard dict={dict} candidate={candidates[2]} place="bronze" index={2} />}
    </div>}
  </div>;
}
