import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gradeImportBatchFindUnique: vi.fn(),
  gradeImportBatchFindUniqueOrThrow: vi.fn(),
  gradeImportBatchFindFirst: vi.fn(),
  gradeImportBatchCreate: vi.fn(),
  gradeImportBatchUpdate: vi.fn(),
  candidateSubjectGradeCreateMany: vi.fn(),
  candidateSubjectGradeFindMany: vi.fn(),
  candidateSubjectGradeDeleteMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    gradeImportBatch: {
      findUnique: mocks.gradeImportBatchFindUnique,
      findUniqueOrThrow: mocks.gradeImportBatchFindUniqueOrThrow,
      findFirst: mocks.gradeImportBatchFindFirst,
      create: mocks.gradeImportBatchCreate,
      update: mocks.gradeImportBatchUpdate
    },
    candidateSubjectGrade: {
      createMany: mocks.candidateSubjectGradeCreateMany,
      findMany: mocks.candidateSubjectGradeFindMany,
      deleteMany: mocks.candidateSubjectGradeDeleteMany
    }
  }
}));

import {
  ConcurrentGradeImportError,
  DuplicateGradeImportError,
  insertGradeRows,
  resumeGradeEligibility,
  rollbackGradeBatch,
  saveGradeDryRunReport
} from "@/lib/grades/grade-import-batches";
import type { ValidationReport } from "@/lib/grades/validate";

function dryRunInput(overrides: Partial<Parameters<typeof saveGradeDryRunReport>[0]> = {}) {
  return {
    sourceFileName: "grades.json",
    sourceType: "JSON" as const,
    checksum: "abc",
    schemeChecksum: "scheme-checksum-1",
    candidateDatasetChecksum: "candidate-checksum-1",
    examYearId: "year-1",
    examType: "bac",
    totalRows: 1,
    report: emptyReport(),
    adminId: "admin-1",
    uploadId: "upload-1",
    ...overrides
  };
}

function emptyReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    importable: [],
    unmatched: [],
    seriesMismatch: [],
    duplicateInputRows: [],
    unknownSubjectCodes: [],
    malformedMarks: [],
    incompleteSubjectSets: [],
    unexpectedSubjectSets: [],
    ...overrides
  };
}

describe("resumeGradeEligibility", () => {
  it("allows resuming a VALIDATED batch that has a stored upload", () => {
    expect(resumeGradeEligibility({ status: "VALIDATED", uploadId: "upload-1" })).toBe("OK");
  });

  it("allows resuming an IMPORTING batch that was interrupted mid-way", () => {
    expect(resumeGradeEligibility({ status: "IMPORTING", uploadId: "upload-1" })).toBe("OK");
  });

  it("rejects a batch that has already been imported", () => {
    expect(resumeGradeEligibility({ status: "IMPORTED", uploadId: "upload-1" })).toBe("ALREADY_IMPORTED");
  });

  it("rejects a VALIDATED batch with no stored upload", () => {
    expect(resumeGradeEligibility({ status: "VALIDATED", uploadId: null })).toBe("CANNOT_RESUME_BATCH");
  });

  it("rejects a FAILED batch even if it has a stored upload", () => {
    expect(resumeGradeEligibility({ status: "FAILED", uploadId: "upload-1" })).toBe("CANNOT_RESUME_BATCH");
  });

  it("rejects a ROLLED_BACK batch", () => {
    expect(resumeGradeEligibility({ status: "ROLLED_BACK", uploadId: "upload-1" })).toBe("CANNOT_RESUME_BATCH");
  });
});

describe("saveGradeDryRunReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the batch FAILED when unknownSubjectCodes is non-empty, regardless of how many rows are otherwise importable", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue(null);
    mocks.gradeImportBatchCreate.mockImplementation(({ data }) => Promise.resolve({ id: "batch-1", ...data }));
    const report = emptyReport({
      importable: [{ examYear: 2026, examType: "bac", candidateNumber: "00001", series: "SN", subjectCode: "MT", mark: 12, status: "GRADED", candidateId: "cand-1" }],
      unknownSubjectCodes: [{ row: { examYear: 2026, examType: "bac", candidateNumber: "00002", series: "SN", subjectCode: "ZZ", mark: 5, status: "GRADED" } }]
    });
    const batch = await saveGradeDryRunReport(dryRunInput({ totalRows: 2, report }));
    expect(batch.status).toBe("FAILED");
  });

  it("marks the batch VALIDATED when there are no unknown subject codes", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue(null);
    mocks.gradeImportBatchCreate.mockImplementation(({ data }) => Promise.resolve({ id: "batch-1", ...data }));
    const report = emptyReport({ importable: [{ examYear: 2026, examType: "bac", candidateNumber: "00001", series: "SN", subjectCode: "MT", mark: 12, status: "GRADED", candidateId: "cand-1" }] });
    const batch = await saveGradeDryRunReport(dryRunInput({ totalRows: 1, report }));
    expect(batch.status).toBe("VALIDATED");
  });

  it("counts graded and exempt rows separately within the stored report, never mixing them into rejected", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue(null);
    let savedData: Record<string, unknown> = {};
    mocks.gradeImportBatchCreate.mockImplementation(({ data }) => { savedData = data; return Promise.resolve({ id: "batch-1", ...data }); });
    const report = emptyReport({
      importable: [
        { examYear: 2026, examType: "bac", candidateNumber: "00001", series: "SN", subjectCode: "MT", mark: 12, status: "GRADED", candidateId: "cand-1" },
        { examYear: 2026, examType: "bac", candidateNumber: "00001", series: "SN", subjectCode: "EP", mark: null, status: "EXEMPT", candidateId: "cand-1" }
      ]
    });
    await saveGradeDryRunReport(dryRunInput({ totalRows: 2, report }));
    const stored = savedData.dryRunReport as { gradedCount: number; exemptCount: number; importableCount: number };
    expect(stored.gradedCount).toBe(1);
    expect(stored.exemptCount).toBe(1);
    expect(stored.importableCount).toBe(2);
    expect(savedData.rejectedRows).toBe(0);
  });

  it("throws DuplicateGradeImportError and never creates a new row when the checksum was already fully imported", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue({ id: "existing", status: "IMPORTED" });
    await expect(saveGradeDryRunReport(dryRunInput({ uploadId: null }))).rejects.toThrow(DuplicateGradeImportError);
    expect(mocks.gradeImportBatchCreate).not.toHaveBeenCalled();
  });

  it("stores the scheme and candidate dataset checksums on the batch, for later commit-time comparison", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue(null);
    mocks.gradeImportBatchCreate.mockImplementation(({ data }) => Promise.resolve({ id: "batch-1", ...data }));
    const batch = await saveGradeDryRunReport(dryRunInput({ schemeChecksum: "scheme-xyz", candidateDatasetChecksum: "candidates-xyz" }));
    expect(batch.schemeChecksum).toBe("scheme-xyz");
    expect(batch.candidateDatasetChecksum).toBe("candidates-xyz");
  });

  it("caps each report category at 200 entries so a huge dry run never bloats the stored JSON", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue(null);
    let savedData: Record<string, unknown> = {};
    mocks.gradeImportBatchCreate.mockImplementation(({ data }) => { savedData = data; return Promise.resolve({ id: "batch-1", ...data }); });
    const many = Array.from({ length: 500 }, (_, index) => ({ row: { examYear: 2026, examType: "bac", candidateNumber: String(index), series: "SN", subjectCode: "MT", mark: 12, status: "GRADED" as const } }));
    await saveGradeDryRunReport(dryRunInput({
      totalRows: 500, report: emptyReport({ unmatched: many }), uploadId: null
    }));
    const stored = savedData.dryRunReport as { unmatched: unknown[]; unmatchedCount: number };
    expect(stored.unmatched).toHaveLength(200);
    expect(stored.unmatchedCount).toBe(500);
  });
});

describe("insertGradeRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gradeImportBatchFindUniqueOrThrow.mockResolvedValue({ progressRows: 0, startedAt: null, examYearId: "year-1" });
    mocks.gradeImportBatchFindFirst.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({
      candidateSubjectGrade: { createMany: mocks.candidateSubjectGradeCreateMany },
      gradeImportBatch: { update: mocks.gradeImportBatchUpdate }
    }));
  });

  function row(candidateId: string) {
    return { candidateId, subjectSchemeId: "scheme-1", mark: 12, status: "GRADED" as const };
  }

  function exemptRow(candidateId: string) {
    return { candidateId, subjectSchemeId: "scheme-1", mark: null, status: "EXEMPT" as const };
  }

  it("inserts every row and flips the batch to IMPORTED when there is no prior progress", async () => {
    mocks.candidateSubjectGradeCreateMany.mockResolvedValue({ count: 2 });
    mocks.gradeImportBatchUpdate.mockResolvedValue({});
    await insertGradeRows({ batchId: "batch-1", rows: [row("c1"), row("c2")] });
    expect(mocks.candidateSubjectGradeCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.candidateSubjectGradeCreateMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(mocks.gradeImportBatchUpdate).toHaveBeenLastCalledWith({ where: { id: "batch-1" }, data: expect.objectContaining({ status: "IMPORTED" }) });
  });

  it("resumes from the last committed chunk instead of redoing already-inserted rows", async () => {
    mocks.gradeImportBatchFindUniqueOrThrow.mockResolvedValue({ progressRows: 2000, startedAt: new Date(), examYearId: "year-1" });
    mocks.candidateSubjectGradeCreateMany.mockResolvedValue({ count: 1 });
    mocks.gradeImportBatchUpdate.mockResolvedValue({});
    const rows = Array.from({ length: 2001 }, (_, index) => row(`c${index}`));
    await insertGradeRows({ batchId: "batch-1", rows });
    expect(mocks.candidateSubjectGradeCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.candidateSubjectGradeCreateMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("does not re-check for a concurrent batch when resuming a batch that is already IMPORTING itself", async () => {
    mocks.gradeImportBatchFindUniqueOrThrow.mockResolvedValue({ progressRows: 0, startedAt: new Date(), examYearId: "year-1" });
    mocks.candidateSubjectGradeCreateMany.mockResolvedValue({ count: 1 });
    mocks.gradeImportBatchUpdate.mockResolvedValue({});
    await insertGradeRows({ batchId: "batch-1", rows: [row("c1")] });
    expect(mocks.gradeImportBatchFindFirst).not.toHaveBeenCalled();
  });

  it("throws ConcurrentGradeImportError and writes nothing when another batch is already IMPORTING for the same exam year", async () => {
    mocks.gradeImportBatchFindFirst.mockResolvedValue({ id: "other-batch" });
    await expect(insertGradeRows({ batchId: "batch-1", rows: [row("c1")] })).rejects.toThrow(ConcurrentGradeImportError);
    expect(mocks.gradeImportBatchFindFirst).toHaveBeenCalledWith({ where: { examYearId: "year-1", status: "IMPORTING", id: { not: "batch-1" } }, select: { id: true } });
    expect(mocks.candidateSubjectGradeCreateMany).not.toHaveBeenCalled();
  });

  it("throws ConcurrentGradeImportError when the IMPORTING transition itself races into the partial unique index", async () => {
    mocks.gradeImportBatchFindFirst.mockResolvedValue(null);
    mocks.gradeImportBatchUpdate.mockRejectedValueOnce({ code: "P2002" });
    await expect(insertGradeRows({ batchId: "batch-1", rows: [row("c1")] })).rejects.toThrow(ConcurrentGradeImportError);
    expect(mocks.candidateSubjectGradeCreateMany).not.toHaveBeenCalled();
  });

  it("inserts both GRADED and EXEMPT rows, writing status and a null mark for the exempt one", async () => {
    mocks.candidateSubjectGradeCreateMany.mockResolvedValue({ count: 2 });
    mocks.gradeImportBatchUpdate.mockResolvedValue({});
    await insertGradeRows({ batchId: "batch-1", rows: [row("c1"), exemptRow("c2")] });
    const inserted = mocks.candidateSubjectGradeCreateMany.mock.calls[0][0].data;
    expect(inserted).toEqual([
      { candidateId: "c1", subjectSchemeId: "scheme-1", mark: 12, status: "GRADED", noteS1: null, noteS2: null, sourceBatchId: "batch-1" },
      { candidateId: "c2", subjectSchemeId: "scheme-1", mark: null, status: "EXEMPT", noteS1: null, noteS2: null, sourceBatchId: "batch-1" }
    ]);
  });
});

describe("rollbackGradeBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      candidateSubjectGrade: { findMany: mocks.candidateSubjectGradeFindMany, deleteMany: mocks.candidateSubjectGradeDeleteMany }
    }));
  });

  it("deletes only this batch's grades, in chunks, and marks the batch ROLLED_BACK", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue({ id: "batch-1", status: "IMPORTED" });
    mocks.candidateSubjectGradeFindMany
      .mockResolvedValueOnce(Array.from({ length: 2000 }, (_, index) => ({ id: `g${index}` })))
      .mockResolvedValueOnce(Array.from({ length: 1 }, (_, index) => ({ id: `g-last-${index}` })));
    mocks.gradeImportBatchUpdate.mockResolvedValue({ status: "ROLLED_BACK" });

    const result = await rollbackGradeBatch("batch-1");

    expect(mocks.candidateSubjectGradeFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.candidateSubjectGradeFindMany.mock.calls[0][0]).toMatchObject({ where: { sourceBatchId: "batch-1" } });
    expect(mocks.candidateSubjectGradeDeleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.gradeImportBatchUpdate).toHaveBeenCalledWith({ where: { id: "batch-1" }, data: expect.objectContaining({ status: "ROLLED_BACK" }) });
    expect(result).toEqual({ status: "ROLLED_BACK" });
  });

  it("throws BATCH_NOT_FOUND and deletes nothing when the batch does not exist", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue(null);
    await expect(rollbackGradeBatch("missing")).rejects.toThrow("BATCH_NOT_FOUND");
    expect(mocks.candidateSubjectGradeDeleteMany).not.toHaveBeenCalled();
  });

  it("is a no-op (other than returning the batch) if it was already rolled back", async () => {
    mocks.gradeImportBatchFindUnique.mockResolvedValue({ id: "batch-1", status: "ROLLED_BACK" });
    const result = await rollbackGradeBatch("batch-1");
    expect(result).toEqual({ id: "batch-1", status: "ROLLED_BACK" });
    expect(mocks.candidateSubjectGradeFindMany).not.toHaveBeenCalled();
  });
});
