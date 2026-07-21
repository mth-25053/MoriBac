import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedCandidate } from "@/lib/excel";

const mocks = vi.hoisted(() => ({
  candidateFindFirst: vi.fn(),
  candidateCreateMany: vi.fn(),
  importBatchUpdate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    candidate: { findFirst: mocks.candidateFindFirst, createMany: mocks.candidateCreateMany },
    importBatch: { update: mocks.importBatchUpdate }
  }
}));

import { DuplicateCandidateError, insertCandidates, resumeEligibility } from "@/lib/import-batches";
import { expireStaleUploads } from "@/lib/import-upload";

function candidate(candidateNumber: string): ParsedCandidate {
  return {
    candidateNumber,
    fullName: "Test Candidate",
    series: "SN",
    average: 12,
    decision: "ADMIS",
    officialDecision: "Admis",
    wilaya: null,
    examCenter: null,
    school: null,
    birthDate: null,
    birthPlace: null,
    candidateType: null
  };
}

describe("resuming a validated import batch without re-uploading", () => {
  it("allows resuming a VALIDATED batch that has a stored upload", () => {
    expect(resumeEligibility({ status: "VALIDATED", uploadId: "upload-1" })).toBe("OK");
  });

  it("rejects a batch that has already been imported", () => {
    expect(resumeEligibility({ status: "IMPORTED", uploadId: "upload-1" })).toBe("ALREADY_IMPORTED");
  });

  it("rejects a FAILED batch even if it has a stored upload", () => {
    expect(resumeEligibility({ status: "FAILED", uploadId: "upload-1" })).toBe("CANNOT_RESUME_BATCH");
  });

  it("rejects a VALIDATED batch with no stored upload (legacy pre-fix data)", () => {
    expect(resumeEligibility({ status: "VALIDATED", uploadId: null })).toBe("CANNOT_RESUME_BATCH");
  });
});

describe("insertCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({
      candidate: { findFirst: mocks.candidateFindFirst, createMany: mocks.candidateCreateMany },
      importBatch: { update: mocks.importBatchUpdate }
    }));
  });

  it("inserts every row and flips the batch to IMPORTED when there is no duplicate", async () => {
    mocks.candidateFindFirst.mockResolvedValue(null);
    mocks.candidateCreateMany.mockResolvedValue({ count: 2 });
    mocks.importBatchUpdate.mockResolvedValue({});

    await insertCandidates({ examYearId: "year-1", batchId: "batch-1", rows: [candidate("00001"), candidate("00002")] });

    expect(mocks.candidateCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.importBatchUpdate).toHaveBeenCalledWith({ where: { id: "batch-1" }, data: expect.objectContaining({ status: "IMPORTED" }) });
  });

  it("throws DuplicateCandidateError and never inserts when a candidate number already exists", async () => {
    mocks.candidateFindFirst.mockResolvedValue({ candidateNumber: "00001" });

    await expect(insertCandidates({ examYearId: "year-1", batchId: "batch-1", rows: [candidate("00001")] }))
      .rejects.toThrow(DuplicateCandidateError);
    expect(mocks.candidateCreateMany).not.toHaveBeenCalled();
    expect(mocks.importBatchUpdate).not.toHaveBeenCalled();
  });
});

describe("expireStaleUploads", () => {
  it("keeps an upload still referenced by a non-IMPORTED batch, deletes an unreferenced one", async () => {
    const findMany = vi.fn().mockResolvedValue([{ uploadId: "in-use-upload" }]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { importBatch: { findMany }, importUpload: { deleteMany } } as unknown as Parameters<typeof expireStaleUploads>[0];

    await expireStaleUploads(tx, "admin-1", new Date("2026-01-01"));

    expect(findMany).toHaveBeenCalledWith({
      where: { adminId: "admin-1", status: { not: "IMPORTED" }, uploadId: { not: null } },
      select: { uploadId: true }
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { adminId: "admin-1", createdAt: { lt: new Date("2026-01-01") }, id: { notIn: ["in-use-upload"] } }
    });
  });
});
