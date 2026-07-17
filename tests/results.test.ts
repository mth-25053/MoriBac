import { describe, expect, it, vi } from "vitest";
import { browseResults, findCandidateResult, getFilterOptions, resultOrder, resultWhere } from "@/lib/results";

const filters = { series: "M", wilaya: "Trarza", center: "", school: "", sort: "lowest", page: 1 };
function candidate(overrides: Record<string, unknown> = {}) {
  return { candidateNumber: "00002", fullName: "Candidate", series: "M", average: 8.47, decision: "SESSIONNAIRE", wilaya: "Trarza", examCenter: "Centre", school: "School", ...overrides };
}

describe("mandatory browsing priority", () => {
  it("shows nothing without a series", () => expect(resultWhere("y", { series: "", wilaya: "", center: "", school: "" })).toBeNull());
  it("uses only the series for Top 10 even after wilaya selection", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "", school: "" })).toEqual({ examYearId: "y", series: "M" }));
  it("ignores series when a center is selected", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "Centre 1", school: "" })).toEqual({ examYearId: "y", examCenter: "Centre 1", wilaya: "Trarza" }));
  it("gives school priority and ignores series", () => expect(resultWhere("y", { series: "M", wilaya: "Trarza", center: "Centre 1", school: "Lycأ©e" })).toEqual({ examYearId: "y", school: "Lycأ©e", examCenter: "Centre 1", wilaya: "Trarza" }));
  it("supports all detailed sorting modes", () => {
    expect(resultOrder("lowest")[0]).toEqual({ average: "asc" });
    expect(resultOrder("name")[0]).toEqual({ fullName: "asc" });
    expect(resultOrder("number")[0]).toEqual({ candidateNumber: "asc" });
    expect(resultOrder("highest")[0]).toEqual({ average: "desc" });
  });

  it("always requests the highest Top 10 for series mode", async () => {
    const database = { candidate: { findMany: vi.fn().mockResolvedValue([candidate()]), count: vi.fn().mockResolvedValue(75) } };
    const result = await browseResults("year", filters, database as never);
    expect(database.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { examYearId: "year", series: "M" }, orderBy: [{ average: "desc" }, { fullName: "asc" }], take: 10, skip: 0 }));
    expect(result.candidates).toHaveLength(1);
  });

  it("returns every series in a center with 50-row server pagination and statistics", async () => {
    const findMany = vi.fn().mockResolvedValue([candidate({ series: "M" }), candidate({ candidateNumber: "10000", series: "SN" })]);
    const count = vi.fn().mockResolvedValueOnce(120).mockResolvedValueOnce(40).mockResolvedValueOnce(20).mockResolvedValueOnce(55);
    const database = { candidate: { findMany, count, aggregate: vi.fn().mockResolvedValue({ _max: { average: 17.95 } }) } };
    const result = await browseResults("year", { ...filters, center: "Centre", page: 2, sort: "name" }, database as never);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { examYearId: "year", examCenter: "Centre", wilaya: "Trarza" }, take: 50, skip: 50 }));
    expect(result.candidates.map((row) => row.series)).toEqual(["M", "SN"]);
    expect(result.pageCount).toBe(3);
    expect(result.statistics).toMatchObject({ total: 120, passed: 40, session: 20, failed: 55, highest: 17.95 });
  });

  it("returns every series in the selected school", async () => {
    const findMany = vi.fn().mockResolvedValue([candidate({ series: "LO" }), candidate({ candidateNumber: "10001", series: "SN" })]);
    const database = { candidate: { findMany, count: vi.fn().mockResolvedValue(2), aggregate: vi.fn().mockResolvedValue({ _max: { average: 10 } }) } };
    const result = await browseResults("year", { ...filters, center: "Centre", school: "School" }, database as never);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { examYearId: "year", school: "School", examCenter: "Centre", wilaya: "Trarza" } }));
    expect(result.candidates.map((row) => row.series)).toEqual(["LO", "SN"]);
  });

  it("loads centers by wilaya without restricting them to the selected series", async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ series: "M" }])
      .mockResolvedValueOnce([{ wilaya: "Trarza" }])
      .mockResolvedValueOnce([{ examCenter: "Lycأ©e Rosso" }])
      .mockResolvedValueOnce([]);
    const database = { candidate: { findMany } };
    const options = await getFilterOptions("year", { series: "M", wilaya: "Trarza" }, database as never);
    expect(findMany.mock.calls[2][0].where).toEqual({ examYearId: "year", wilaya: "Trarza", examCenter: { not: null } });
    expect(options.centers).toEqual(["Lycأ©e Rosso"]);
  });

  it("returns null for an unknown candidate", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    expect(await findCandidateResult("year", "99999", { candidate: { findUnique } } as never)).toBeNull();
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { examYearId_candidateNumber: { examYearId: "year", candidateNumber: "99999" } } }));
  });
});