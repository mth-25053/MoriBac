import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  candidateFindUnique: vi.fn(),
  candidateSubjectGradeFindMany: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    candidate: { findUnique: mocks.candidateFindUnique },
    candidateSubjectGrade: { findMany: mocks.candidateSubjectGradeFindMany }
  }
}));

import { getCandidateSubjectGrades } from "@/lib/grades/public-grades";

describe("getCandidateSubjectGrades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null without querying grades when the candidate does not exist for this exam year", async () => {
    mocks.candidateFindUnique.mockResolvedValue(null);
    const result = await getCandidateSubjectGrades("year-1", "99999");
    expect(result).toBeNull();
    expect(mocks.candidateSubjectGradeFindMany).not.toHaveBeenCalled();
  });

  it("returns an empty array (not null) when the candidate exists but has no recorded grades yet", async () => {
    mocks.candidateFindUnique.mockResolvedValue({ id: "cand-1" });
    mocks.candidateSubjectGradeFindMany.mockResolvedValue([]);
    const result = await getCandidateSubjectGrades("year-1", "00215");
    expect(result).toEqual([]);
  });

  it("returns GRADED grades ordered by displayOrder, with coefficient/mark as plain numbers", async () => {
    mocks.candidateFindUnique.mockResolvedValue({ id: "cand-1" });
    mocks.candidateSubjectGradeFindMany.mockResolvedValue([
      { mark: 15.5, status: "GRADED", subjectScheme: { subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 5, displayOrder: 1 } },
      { mark: 12, status: "GRADED", subjectScheme: { subjectCode: "AR", nameAr: "اللغة العربية", nameFr: "Arabe", coefficient: null, displayOrder: 2 } }
    ]);
    const result = await getCandidateSubjectGrades("year-1", "00215");
    expect(result).toEqual([
      { subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 5, mark: 15.5, status: "GRADED", displayOrder: 1 },
      { subjectCode: "AR", nameAr: "اللغة العربية", nameFr: "Arabe", coefficient: null, mark: 12, status: "GRADED", displayOrder: 2 }
    ]);
    expect(mocks.candidateSubjectGradeFindMany).toHaveBeenCalledWith({
      where: { candidateId: "cand-1" },
      orderBy: { subjectScheme: { displayOrder: "asc" } },
      select: { mark: true, status: true, subjectScheme: { select: { subjectCode: true, nameAr: true, nameFr: true, coefficient: true, displayOrder: true } } }
    });
  });

  it("returns an EXEMPT subject with mark: null and status: EXEMPT, never a numeric mark", async () => {
    mocks.candidateFindUnique.mockResolvedValue({ id: "cand-1" });
    mocks.candidateSubjectGradeFindMany.mockResolvedValue([
      { mark: null, status: "EXEMPT", subjectScheme: { subjectCode: "EP", nameAr: "التربية البدنية", nameFr: "Éducation physique", coefficient: 1, displayOrder: 8 } }
    ]);
    const result = await getCandidateSubjectGrades("year-1", "00215");
    expect(result).toEqual([
      { subjectCode: "EP", nameAr: "التربية البدنية", nameFr: "Éducation physique", coefficient: 1, mark: null, status: "EXEMPT", displayOrder: 8 }
    ]);
  });

  it("looks up the candidate scoped to the given exam year and candidate number", async () => {
    mocks.candidateFindUnique.mockResolvedValue(null);
    await getCandidateSubjectGrades("year-1", "00215");
    expect(mocks.candidateFindUnique).toHaveBeenCalledWith({
      where: { examYearId_candidateNumber: { examYearId: "year-1", candidateNumber: "00215" } },
      select: { id: true }
    });
  });
});
