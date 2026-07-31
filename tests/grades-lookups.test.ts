import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  examYearFindUnique: vi.fn(),
  candidateFindMany: vi.fn(),
  candidateFindUnique: vi.fn(),
  subjectSchemeFindMany: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    examYear: { findUnique: mocks.examYearFindUnique },
    candidate: { findMany: mocks.candidateFindMany, findUnique: mocks.candidateFindUnique },
    subjectScheme: { findMany: mocks.subjectSchemeFindMany }
  }
}));

import { PrismaCandidateLookup, PrismaSubjectSchemeLookup, resolveSubjectSchemeIds } from "@/lib/grades/lookups";

describe("PrismaCandidateLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null without querying candidates when the exam year does not exist", async () => {
    mocks.examYearFindUnique.mockResolvedValue(null);
    const lookup = new PrismaCandidateLookup();
    const result = await lookup.find({ examYear: 2099, examType: "bac", candidateNumber: "00001" });
    expect(result).toBeNull();
    expect(mocks.candidateFindUnique).not.toHaveBeenCalled();
  });

  it("resolves the exam year only once across multiple find() calls for the same year", async () => {
    mocks.examYearFindUnique.mockResolvedValue({ id: "year-1" });
    mocks.candidateFindUnique.mockResolvedValue({ id: "cand-1", series: "SN" });
    const lookup = new PrismaCandidateLookup();
    await lookup.find({ examYear: 2026, examType: "bac", candidateNumber: "00001" });
    await lookup.find({ examYear: 2026, examType: "bac", candidateNumber: "00002" });
    expect(mocks.examYearFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.candidateFindUnique).toHaveBeenCalledTimes(2);
  });

  it("preload() warms the cache in bulk so a subsequent find() never hits candidate.findUnique", async () => {
    mocks.examYearFindUnique.mockResolvedValue({ id: "year-1" });
    mocks.candidateFindMany.mockResolvedValue([{ id: "cand-1", series: "SN", candidateNumber: "00001" }]);
    const lookup = new PrismaCandidateLookup();
    await lookup.preload(2026, "bac", ["00001", "00001", "00002"]);
    expect(mocks.candidateFindMany).toHaveBeenCalledWith({ where: { examYearId: "year-1", candidateNumber: { in: ["00001", "00002"] } }, select: { id: true, series: true, candidateNumber: true } });

    const found = await lookup.find({ examYear: 2026, examType: "bac", candidateNumber: "00001" });
    const notFound = await lookup.find({ examYear: 2026, examType: "bac", candidateNumber: "00002" });
    expect(found).toEqual({ id: "cand-1", series: "SN" });
    expect(notFound).toBeNull();
    expect(mocks.candidateFindUnique).not.toHaveBeenCalled();
  });

  it("chunks a large preload into multiple findMany calls", async () => {
    mocks.examYearFindUnique.mockResolvedValue({ id: "year-1" });
    mocks.candidateFindMany.mockResolvedValue([]);
    const lookup = new PrismaCandidateLookup();
    const numbers = Array.from({ length: 4001 }, (_, index) => String(index));
    await lookup.preload(2026, "bac", numbers);
    expect(mocks.candidateFindMany).toHaveBeenCalledTimes(3);
  });
});

describe("PrismaSubjectSchemeLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list without querying schemes when the exam year does not exist", async () => {
    mocks.examYearFindUnique.mockResolvedValue(null);
    const lookup = new PrismaSubjectSchemeLookup();
    const result = await lookup.listByYear({ examYear: 2099, examType: "bac" });
    expect(result).toEqual([]);
    expect(mocks.subjectSchemeFindMany).not.toHaveBeenCalled();
  });

  it("caches the result per (examYear, examType) so a repeated call never re-queries", async () => {
    mocks.examYearFindUnique.mockResolvedValue({ id: "year-1" });
    mocks.subjectSchemeFindMany.mockResolvedValue([{ series: "SN", subjectCode: "MT" }]);
    const lookup = new PrismaSubjectSchemeLookup();
    await lookup.listByYear({ examYear: 2026, examType: "bac" });
    await lookup.listByYear({ examYear: 2026, examType: "bac" });
    expect(mocks.subjectSchemeFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("resolveSubjectSchemeIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps each (series, subjectCode) row to its actual SubjectScheme id", async () => {
    mocks.subjectSchemeFindMany.mockResolvedValue([
      { id: "scheme-mt-sn", series: "SN", subjectCode: "MT" },
      { id: "scheme-ar-sn", series: "SN", subjectCode: "AR" }
    ]);
    const ids = await resolveSubjectSchemeIds("year-1", "bac", [{ series: "SN", subjectCode: "MT" }, { series: "SN", subjectCode: "AR" }]);
    expect(ids).toEqual(["scheme-mt-sn", "scheme-ar-sn"]);
  });

  it("throws if a row's scheme cannot be resolved - defensive, should never happen after validation", async () => {
    mocks.subjectSchemeFindMany.mockResolvedValue([]);
    await expect(resolveSubjectSchemeIds("year-1", "bac", [{ series: "SN", subjectCode: "MT" }])).rejects.toThrow(/SUBJECT_SCHEME_ID_MISSING/);
  });
});
