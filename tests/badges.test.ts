import { describe, expect, it } from "vitest";
import { computeBadges } from "@/lib/badges";
import { dictionaries } from "@/lib/i18n";
import type { CandidateRanks } from "@/lib/results";

const dict = dictionaries.ar;

function ranks(overrides: Partial<CandidateRanks> = {}): CandidateRanks {
  return { series: 5, wilaya: 8, school: 12, examCenter: 3, national: 40, nationalTotal: 50000, schoolTotal: 300, examCenterTotal: 900, ...overrides };
}

describe("premium badge selection", () => {
  it("shows no badge for a candidate with no ranks (e.g. ANNULE)", () => {
    expect(computeBadges(dict, null)).toEqual([]);
    expect(computeBadges(dict, { series: null, wilaya: null, school: null, examCenter: null, national: null, nationalTotal: null, schoolTotal: null, examCenterTotal: null })).toEqual([]);
  });

  it("prioritizes national first over every other badge", () => {
    const badges = computeBadges(dict, ranks({ national: 1, series: 1, wilaya: 1 }));
    expect(badges[0]).toEqual({ key: "national", label: dict.badgeNationalFirst });
  });

  it("caps at 2 badges even when several 'first place' scopes are true at once", () => {
    const badges = computeBadges(dict, ranks({ national: 1, series: 1, wilaya: 1, school: 1, examCenter: 1 }));
    expect(badges).toHaveLength(2);
  });

  it("falls back to top-10 only when no scope is an outright first place", () => {
    expect(computeBadges(dict, ranks({ national: 7, series: 5 }))).toEqual([{ key: "top10", label: dict.badgeTop10 }]);
  });

  it("falls back to top-50 when outside top-10 but within top-50 nationally", () => {
    expect(computeBadges(dict, ranks({ national: 45, series: 5 }))).toEqual([{ key: "top50", label: dict.badgeTop50 }]);
  });

  it("shows nothing when ranked outside the top 50 and never first", () => {
    expect(computeBadges(dict, ranks({ national: 200, series: 40 }))).toEqual([]);
  });
});
