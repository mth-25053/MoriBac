import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subjectSchemeFindMany: vi.fn(),
  importBatchFindMany: vi.fn(),
  candidateCount: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    subjectScheme: { findMany: mocks.subjectSchemeFindMany },
    importBatch: { findMany: mocks.importBatchFindMany },
    candidate: { count: mocks.candidateCount }
  }
}));

import { computeCandidateDatasetChecksum, computeSchemeChecksum } from "@/lib/grades/dataset-fingerprint";

describe("computeSchemeChecksum", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces the same checksum for the same scheme content", async () => {
    const schemes = [{ id: "s1", series: "SN", subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 5, displayOrder: 1, updatedAt: new Date("2026-01-01") }];
    mocks.subjectSchemeFindMany.mockResolvedValue(schemes);
    const first = await computeSchemeChecksum("year-1", "bac");
    mocks.subjectSchemeFindMany.mockResolvedValue(schemes);
    const second = await computeSchemeChecksum("year-1", "bac");
    expect(first).toBe(second);
  });

  it("changes when a scheme's coefficient changes", async () => {
    mocks.subjectSchemeFindMany.mockResolvedValue([{ id: "s1", series: "SN", subjectCode: "MT", nameAr: null, nameFr: null, coefficient: 5, displayOrder: 1, updatedAt: new Date("2026-01-01") }]);
    const before = await computeSchemeChecksum("year-1", "bac");
    mocks.subjectSchemeFindMany.mockResolvedValue([{ id: "s1", series: "SN", subjectCode: "MT", nameAr: null, nameFr: null, coefficient: 6, displayOrder: 1, updatedAt: new Date("2026-01-02") }]);
    const after = await computeSchemeChecksum("year-1", "bac");
    expect(before).not.toBe(after);
  });

  it("changes when a scheme row is added", async () => {
    mocks.subjectSchemeFindMany.mockResolvedValue([{ id: "s1", series: "SN", subjectCode: "MT", nameAr: null, nameFr: null, coefficient: 5, displayOrder: 1, updatedAt: new Date("2026-01-01") }]);
    const before = await computeSchemeChecksum("year-1", "bac");
    mocks.subjectSchemeFindMany.mockResolvedValue([
      { id: "s1", series: "SN", subjectCode: "MT", nameAr: null, nameFr: null, coefficient: 5, displayOrder: 1, updatedAt: new Date("2026-01-01") },
      { id: "s2", series: "SN", subjectCode: "AR", nameAr: null, nameFr: null, coefficient: 3, displayOrder: 2, updatedAt: new Date("2026-01-01") }
    ]);
    const after = await computeSchemeChecksum("year-1", "bac");
    expect(before).not.toBe(after);
  });

  it("queries scoped to the given exam year and type, ordered deterministically", async () => {
    mocks.subjectSchemeFindMany.mockResolvedValue([]);
    await computeSchemeChecksum("year-1", "bac");
    expect(mocks.subjectSchemeFindMany).toHaveBeenCalledWith({
      where: { examYearId: "year-1", examType: "bac" },
      orderBy: [{ series: "asc" }, { subjectCode: "asc" }],
      select: { id: true, series: true, subjectCode: true, nameAr: true, nameFr: true, coefficient: true, displayOrder: true, updatedAt: true }
    });
  });
});

describe("computeCandidateDatasetChecksum", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces the same checksum for the same batch set and candidate count", async () => {
    mocks.importBatchFindMany.mockResolvedValue([{ id: "b1", status: "IMPORTED", rowsImported: 100 }]);
    mocks.candidateCount.mockResolvedValue(100);
    const first = await computeCandidateDatasetChecksum("year-1");
    const second = await computeCandidateDatasetChecksum("year-1");
    expect(first).toBe(second);
  });

  it("changes when a new import batch is added for the year", async () => {
    mocks.importBatchFindMany.mockResolvedValue([{ id: "b1", status: "IMPORTED", rowsImported: 100 }]);
    mocks.candidateCount.mockResolvedValue(100);
    const before = await computeCandidateDatasetChecksum("year-1");

    mocks.importBatchFindMany.mockResolvedValue([{ id: "b1", status: "IMPORTED", rowsImported: 100 }, { id: "b2", status: "IMPORTED", rowsImported: 50 }]);
    mocks.candidateCount.mockResolvedValue(150);
    const after = await computeCandidateDatasetChecksum("year-1");

    expect(before).not.toBe(after);
  });

  it("changes when a batch is undone (removed) even if the id set otherwise looks similar", async () => {
    mocks.importBatchFindMany.mockResolvedValue([{ id: "b1", status: "IMPORTED", rowsImported: 100 }]);
    mocks.candidateCount.mockResolvedValue(100);
    const before = await computeCandidateDatasetChecksum("year-1");

    mocks.importBatchFindMany.mockResolvedValue([]);
    mocks.candidateCount.mockResolvedValue(0);
    const after = await computeCandidateDatasetChecksum("year-1");

    expect(before).not.toBe(after);
  });

  it("scopes both queries to the given exam year", async () => {
    mocks.importBatchFindMany.mockResolvedValue([]);
    mocks.candidateCount.mockResolvedValue(0);
    await computeCandidateDatasetChecksum("year-1");
    expect(mocks.importBatchFindMany).toHaveBeenCalledWith({ where: { examYearId: "year-1" }, orderBy: { id: "asc" }, select: { id: true, status: true, rowsImported: true } });
    expect(mocks.candidateCount).toHaveBeenCalledWith({ where: { examYearId: "year-1" } });
  });
});
