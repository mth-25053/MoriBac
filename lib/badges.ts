import type { Dictionary } from "@/lib/i18n";
import type { CandidateRanks } from "@/lib/results";

export type Badge = { key: string; label: string };

/**
 * Picks at most 2 badges, most prestigious first: an outright "first place" in any
 * scope always outranks a top-10/top-50 badge, and top-10/top-50 only appear when no
 * "first place" badge applies, so a national #1 isn't diluted by also showing "top 50".
 * All inputs come from getCandidateRanks, which already returns null for ANNULE and
 * for scopes with no recorded value - so a badge here is always factually correct.
 */
export function computeBadges(dict: Dictionary, ranks: CandidateRanks | null | undefined): Badge[] {
  if (!ranks) return [];
  const firsts: Badge[] = [];
  if (ranks.national === 1) firsts.push({ key: "national", label: dict.badgeNationalFirst });
  if (ranks.series === 1) firsts.push({ key: "series", label: dict.badgeSeriesFirst });
  if (ranks.wilaya === 1) firsts.push({ key: "wilaya", label: dict.badgeWilayaFirst });
  if (ranks.school === 1) firsts.push({ key: "school", label: dict.badgeSchoolFirst });
  if (ranks.examCenter === 1) firsts.push({ key: "center", label: dict.badgeCenterFirst });
  if (firsts.length > 0) return firsts.slice(0, 2);

  if (ranks.national !== null && ranks.national <= 10) return [{ key: "top10", label: dict.badgeTop10 }];
  if (ranks.national !== null && ranks.national <= 50) return [{ key: "top50", label: dict.badgeTop50 }];
  return [];
}
