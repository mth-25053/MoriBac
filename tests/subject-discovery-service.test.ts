import { describe, expect, it, vi } from "vitest";
import { buildDiscoveryReport, confirmDiscoveredSchemes } from "@/lib/grades/subject-discovery-service";
import { DuplicateSubjectSchemeError } from "@/lib/grades/subject-scheme-repository";
import type { NormalizedGradeRow } from "@/lib/grades/types";

function row(overrides: Partial<NormalizedGradeRow> = {}): NormalizedGradeRow {
  return { examYear: 2026, examType: "bac", candidateNumber: "00001", series: "SN", subjectCode: "MT", mark: 12, status: "GRADED", ...overrides };
}

describe("buildDiscoveryReport - no database writes during preview", () => {
  it("only ever calls repository.list() - a fake repository exposing just list() satisfies the whole call, proving no create/update/delete path exists", async () => {
    const listSpy = vi.fn().mockResolvedValue([]);
    const fakeRepository = { list: listSpy };
    const report = await buildDiscoveryReport("year-1", "bac", [row()], fakeRepository);
    expect(listSpy).toHaveBeenCalledWith("year-1", "bac");
    expect(report.proposedSchemes).toHaveLength(1);
  });

  it("skips the repository call entirely when the exam year does not exist yet, and marks nothing as already existing", async () => {
    const listSpy = vi.fn();
    const report = await buildDiscoveryReport(null, "bac", [row()], { list: listSpy });
    expect(listSpy).not.toHaveBeenCalled();
    expect(report.proposedSchemes[0].alreadyExists).toBe(false);
  });

  it("marks a proposed scheme as already existing when a matching SubjectScheme row is returned by list()", async () => {
    const listSpy = vi.fn().mockResolvedValue([{ series: "SN", subjectCode: "MT" }]);
    const report = await buildDiscoveryReport("year-1", "bac", [row({ series: "SN", subjectCode: "MT" }), row({ series: "SN", subjectCode: "AR" })], { list: listSpy });
    const mt = report.proposedSchemes.find((s) => s.subjectCode === "MT")!;
    const ar = report.proposedSchemes.find((s) => s.subjectCode === "AR")!;
    expect(mt.alreadyExists).toBe(true);
    expect(ar.alreadyExists).toBe(false);
  });
});

describe("confirmDiscoveredSchemes - the explicit, separate write step", () => {
  function schemeInput(overrides: Partial<Parameters<typeof confirmDiscoveredSchemes>[2][number]> = {}) {
    return { series: "SN", subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: null, displayOrder: 0, ...overrides };
  }

  it("creates every approved scheme via the repository and reports each as created", async () => {
    const create = vi.fn().mockResolvedValue({ id: "s1" });
    const results = await confirmDiscoveredSchemes("year-1", "bac", [schemeInput()], { create } as never);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ examYearId: "year-1", examType: "bac", series: "SN", subjectCode: "MT" }));
    expect(results).toEqual([{ series: "SN", subjectCode: "MT", status: "created" }]);
  });

  it("reports a duplicate without throwing and continues to the next scheme", async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new DuplicateSubjectSchemeError("bac", "SN", "MT"))
      .mockResolvedValueOnce({ id: "s2" });
    const results = await confirmDiscoveredSchemes("year-1", "bac", [schemeInput({ subjectCode: "MT" }), schemeInput({ subjectCode: "AR" })], { create } as never);
    expect(results).toEqual([
      { series: "SN", subjectCode: "MT", status: "duplicate" },
      { series: "SN", subjectCode: "AR", status: "created" }
    ]);
  });

  it("reports an unexpected error without aborting the rest of the batch", async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "s2" });
    const results = await confirmDiscoveredSchemes("year-1", "bac", [schemeInput({ subjectCode: "MT" }), schemeInput({ subjectCode: "AR" })], { create } as never);
    expect(results[0]).toMatchObject({ subjectCode: "MT", status: "error", message: "boom" });
    expect(results[1]).toMatchObject({ subjectCode: "AR", status: "created" });
  });
});
