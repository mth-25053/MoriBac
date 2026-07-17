import { describe, expect, it, vi } from "vitest";
import { candidateRank, decisionBadgeClass } from "@/lib/decision";
import { browseResults, findCandidateResult, getFilterOptions, resultOrder, resultWhere } from "@/lib/results";

const filters = { series: "M", wilaya: "Trarza", center: "", school: "", sort: "lowest", page: 1 };
function candidate(overrides: Record<string, unknown> = {}) {
  return { candidateNumber: "00002", fullName: "Candidate", series: "M", average: 8.47, decision: "SESSIONNAIRE", wilaya: "Trarza", examCenter: "Centre", school: "School", ...overrides };
}
const rankable = (examYearId = "y") => ({ examYearId, decision: { not: "ANNULE" } });

describe("ranking and browsing business rules", () => {
  it("shows nothing without a ranking filter", () => expect(resultWhere("y", { series: "", wilaya: "", center: "", school: "" })).toBeNull());
  it("excludes ANNULE from Top 10 while using only the series", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "", school: "" })).toEqual({ ...rankable(), series: "M" }));
  it("excludes ANNULE from center rankings", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "Centre 1", school: "" })).toEqual({ ...rankable(), examCenter: "Centre 1", wilaya: "Trarza" }));
  it("excludes ANNULE from school rankings", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "Centre 1", school: "School" })).toEqual({ ...rankable(), school: "School", examCenter: "Centre 1", wilaya: "Trarza" }));
  it("supports all detailed sorting modes", () => {
    expect(resultOrder("lowest")[0]).toEqual({ average: "asc" });
    expect(resultOrder("name")[0]).toEqual({ fullName: "asc" });
    expect(resultOrder("number")[0]).toEqual({ candidateNumber: "asc" });
    expect(resultOrder("highest")[0]).toEqual({ average: "desc" });
  });

  it("requests only rankable candidates for every series Top 10", async () => {
    const database = { candidate: { findMany: vi.fn().mockResolvedValue([candidate()]), count: vi.fn().mockResolvedValue(75) } };
    const result = await browseResults("year", filters, database as never);
    expect(database.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ...rankable("year"), series: "M" }, orderBy: [{ average: "desc" }, { fullName: "asc" }], take: 10, skip: 0 }));
    expect(database.candidate.count).toHaveBeenCalledWith({ where: { ...rankable("year"), series: "M" } });
    expect(result.candidates).toHaveLength(1);
  });

  it("excludes ANNULE from center rows, rankings, outcome counts, highest average, and rate denominator", async () => {
    const findMany = vi.fn().mockResolvedValue([candidate({ series: "M" }), candidate({ candidateNumber: "10000", series: "SN" })]);
    const count = vi.fn().mockResolvedValueOnce(120).mockResolvedValueOnce(40).mockResolvedValueOnce(20).mockResolvedValueOnce(55);
    const aggregate = vi.fn().mockResolvedValue({ _max: { average: 17.95 } });
    const database = { candidate: { findMany, count, aggregate } };
    const result = await browseResults("year", { ...filters, center: "Centre", page: 2, sort: "name" }, database as never);
    const where = { ...rankable("year"), examCenter: "Centre", wilaya: "Trarza" };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 50, skip: 50 }));
    expect(count.mock.calls.map((call) => call[0])).toEqual([
      { where },
      { where: { AND: [where, { decision: "ADMIS" }] } },
      { where: { AND: [where, { decision: "SESSIONNAIRE" }] } },
      { where: { AND: [where, { decision: "REDOUBLE" }] } }
    ]);
    expect(aggregate).toHaveBeenCalledWith({ where, _max: { average: true } });
    expect(result.pageCount).toBe(3);
    expect(result.statistics).toMatchObject({ total: 120, passed: 40, session: 20, failed: 55, highest: 17.95, successRate: 40 / 120 * 100 });
  });

  it("excludes ANNULE from school rows and rankings", async () => {
    const findMany = vi.fn().mockResolvedValue([candidate({ series: "LO" }), candidate({ candidateNumber: "10001", series: "SN" })]);
    const database = { candidate: { findMany, count: vi.fn().mockResolvedValue(2), aggregate: vi.fn().mockResolvedValue({ _max: { average: 10 } }) } };
    await browseResults("year", { ...filters, center: "Centre", school: "School" }, database as never);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ...rankable("year"), school: "School", examCenter: "Centre", wilaya: "Trarza" } }));
  });

  it("excludes ANNULE-only values from ranking filter options", async () => {
    const findMany = vi.fn().mockResolvedValueOnce([{ series: "M" }]).mockResolvedValueOnce([{ wilaya: "Trarza" }]).mockResolvedValueOnce([{ examCenter: "Lycée Rosso" }]).mockResolvedValueOnce([]);
    const database = { candidate: { findMany } };
    const options = await getFilterOptions("year", { series: "M", wilaya: "Trarza" }, database as never);
    expect(findMany.mock.calls[0][0].where).toEqual(rankable("year"));
    expect(findMany.mock.calls[2][0].where).toEqual({ ...rankable("year"), wilaya: "Trarza", examCenter: { not: null } });
    expect(options.centers).toEqual(["Lycée Rosso"]);
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
    expect(decisionBadgeClass("REDOUBLE")).toBe("fail");
    expect(decisionBadgeClass("ADMIS")).toBe("");
  });
});