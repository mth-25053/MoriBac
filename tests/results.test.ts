import { describe, expect, it, vi } from "vitest";
import { candidateRank, decisionBadgeClass } from "@/lib/decision";
import { browseResults, findCandidateResult, getFilterOptions, resultOrder, resultWhere } from "@/lib/results";

const filters = { series: "M", wilaya: "Trarza", center: "", school: "", sort: "lowest", page: 1 };
function candidate(overrides: Record<string, unknown> = {}) {
  return { candidateNumber: "00002", fullName: "Candidate", series: "M", average: 8.47, decision: "SESSIONNAIRE", wilaya: "Trarza", examCenter: "Centre", school: "School", ...overrides };
}
const rankable = (examYearId = "y") => ({ examYearId, decision: { not: "ANNULE" } });

describe("ranking and browsing business rules", () => {
  it("falls back to the national ranking scope without any filter", () => expect(resultWhere("y", { series: "", wilaya: "", center: "", school: "" })).toEqual(rankable("y")));
  it("scopes the ranking to series alone", () => expect(resultWhere("y", { series: "M", wilaya: "", center: "", school: "" })).toEqual({ ...rankable(), series: "M" }));
  it("scopes the ranking to wilaya alone", () => expect(resultWhere("y", { series: "", wilaya: "Trarza", center: "", school: "" })).toEqual({ ...rankable(), wilaya: "Trarza" }));
  it("combines series and wilaya for a wilaya ranking", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "", school: "" })).toEqual({ ...rankable(), series: "M", wilaya: "Trarza" }));
  it("keeps series scoped for center rosters and does not exclude any decision", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "Centre 1", school: "" })).toEqual({ examYearId: "y", series: "M", wilaya: "Trarza", examCenter: "Centre 1" }));
  it("keeps series scoped for school rosters and does not exclude any decision", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "", school: "School" })).toEqual({ examYearId: "y", series: "M", wilaya: "Trarza", school: "School" }));
  it("supports all detailed sorting modes", () => {
    expect(resultOrder("lowest")[0]).toEqual({ average: "asc" });
    expect(resultOrder("name")[0]).toEqual({ fullName: "asc" });
    expect(resultOrder("number")[0]).toEqual({ candidateNumber: "asc" });
    expect(resultOrder("highest")[0]).toEqual({ average: "desc" });
  });

  it("requests only rankable candidates for the series Top 50", async () => {
    const database = { candidate: { findMany: vi.fn().mockResolvedValue([candidate()]), count: vi.fn().mockResolvedValue(75) } };
    const result = await browseResults("year", filters, database as never);
    expect(database.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ...rankable("year"), series: "M", wilaya: "Trarza" }, orderBy: [{ average: "desc" }, { fullName: "asc" }], take: 50, skip: 0 }));
    expect(database.candidate.count).toHaveBeenCalledWith({ where: { ...rankable("year"), series: "M", wilaya: "Trarza" } });
    expect(result.candidates).toHaveLength(1);
  });

  it("includes every decision in center rows, counts cancelled/absent, and reports the full average range", async () => {
    const findMany = vi.fn().mockResolvedValue([candidate({ series: "M" }), candidate({ candidateNumber: "10000", series: "SN" })]);
    const count = vi.fn()
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(55)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    const aggregate = vi.fn().mockResolvedValue({ _max: { average: 17.95 }, _min: { average: 4.1 } });
    const database = { candidate: { findMany, count, aggregate } };
    const result = await browseResults("year", { ...filters, center: "Centre", page: 2, sort: "name" }, database as never);
    const where = { examYearId: "year", series: "M", wilaya: "Trarza", examCenter: "Centre" };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 50, skip: 50 }));
    expect(count.mock.calls.map((call) => call[0])).toEqual([
      { where },
      { where: { AND: [where, { decision: "ADMIS" }] } },
      { where: { AND: [where, { decision: "SESSIONNAIRE" }] } },
      { where: { AND: [where, { decision: "REDOUBLE" }] } },
      { where: { AND: [where, { decision: "ANNULE" }] } },
      { where: { AND: [where, { decision: "ABSENT" }] } }
    ]);
    expect(aggregate).toHaveBeenCalledWith({ where, _max: { average: true }, _min: { average: true } });
    expect(result.pageCount).toBe(3);
    expect(result.statistics).toMatchObject({ total: 120, passed: 40, session: 20, failed: 55, cancelled: 3, absent: 2, highest: 17.95, lowest: 4.1, successRate: 40 / 120 * 100 });
  });

  it("includes every decision in school rows and rankings", async () => {
    const findMany = vi.fn().mockResolvedValue([candidate({ series: "LO" }), candidate({ candidateNumber: "10001", series: "SN" })]);
    const database = { candidate: { findMany, count: vi.fn().mockResolvedValue(2), aggregate: vi.fn().mockResolvedValue({ _max: { average: 10 }, _min: { average: 5 } }) } };
    await browseResults("year", { ...filters, school: "School" }, database as never);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { examYearId: "year", series: "M", wilaya: "Trarza", school: "School" } }));
  });

  it("excludes ANNULE-only values from ranking filter options and keeps school independent of center", async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ series: "M" }])
      .mockResolvedValueOnce([{ wilaya: "Trarza" }])
      .mockResolvedValueOnce([{ examCenter: "Lycée Rosso" }])
      .mockResolvedValueOnce([{ school: "École Rosso" }]);
    const database = { candidate: { findMany } };
    const options = await getFilterOptions("year", { series: "M", wilaya: "Trarza" }, database as never);
    expect(findMany.mock.calls[0][0].where).toEqual(rankable("year"));
    expect(findMany.mock.calls[2][0].where).toEqual({ ...rankable("year"), series: "M", wilaya: "Trarza", examCenter: { not: null } });
    expect(findMany.mock.calls[3][0].where).toEqual({ ...rankable("year"), series: "M", wilaya: "Trarza", school: { not: null } });
    expect(options.centers).toEqual(["Lycée Rosso"]);
    expect(options.schools).toEqual(["École Rosso"]);
  });

  it.each([0, 19.75])("keeps an ANNULE candidate searchable regardless of average %s", async (average) => {
    const cancelled = candidate({ decision: "ANNULE", average });
    const findUnique = vi.fn().mockResolvedValue(cancelled);
    await expect(findCandidateResult("year", "00009", { candidate: { findUnique } } as never)).resolves.toEqual(cancelled);
  });

  it("keeps valid non-cancelled candidate search unchanged", async () => {
    const normal = candidate({ decision: "ADMIS", average: 14 });
    const findUnique = vi.fn().mockResolvedValue(normal);
    await expect(findCandidateResult("year", "00002", { candidate: { findUnique } } as never)).resolves.toEqual(normal);
  });

  it("never assigns a displayed rank or failure style to ANNULE", () => {
    expect(candidateRank("ANNULE", 1)).toBeNull();
    expect(candidateRank("ADMIS", 1)).toBe(1);
    expect(decisionBadgeClass("ANNULE")).toBe("cancelled");
    expect(decisionBadgeClass("REDOUBLE")).toBe("calm");
    expect(decisionBadgeClass("ADMIS")).toBe("");
  });
});