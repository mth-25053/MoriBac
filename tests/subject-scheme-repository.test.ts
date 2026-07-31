import { beforeEach, describe, expect, it, vi } from "vitest";
import { subjectSchemeUpdateSchema } from "@/lib/validation";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  gradeCount: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    subjectScheme: { findUnique: mocks.findUnique, findMany: mocks.findMany, create: mocks.create, update: mocks.update, delete: mocks.delete },
    candidateSubjectGrade: { count: mocks.gradeCount }
  }
}));

import {
  DuplicateSubjectSchemeError,
  SubjectSchemeInUseError,
  SubjectSchemeNotFoundError,
  SubjectSchemeRepository
} from "@/lib/grades/subject-scheme-repository";

const repository = new SubjectSchemeRepository();

function input(overrides: Partial<Parameters<typeof repository.create>[0]> = {}) {
  return { examYearId: "year-1", examType: "bac", series: "SN", subjectCode: "MT", nameAr: null, nameFr: null, coefficient: null, displayOrder: 1, ...overrides };
}

describe("SubjectSchemeRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists schemes for a year and exam type, ordered by series then display order", async () => {
    mocks.findMany.mockResolvedValue([{ id: "s1" }]);
    const result = await repository.list("year-1");
    expect(result).toEqual([{ id: "s1" }]);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { examYearId: "year-1", examType: "bac" },
      orderBy: [{ series: "asc" }, { displayOrder: "asc" }]
    });
  });

  it("creates a new scheme when no duplicate exists for this year/type/series/code", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "s1", ...input() });
    const created = await repository.create(input());
    expect(created.id).toBe("s1");
    expect(mocks.create).toHaveBeenCalledWith({ data: input() });
  });

  it("throws DuplicateSubjectSchemeError and never creates when the identity already exists", async () => {
    mocks.findUnique.mockResolvedValue({ id: "existing" });
    await expect(repository.create(input())).rejects.toThrow(DuplicateSubjectSchemeError);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("updates an existing scheme's editable fields", async () => {
    mocks.findUnique.mockResolvedValue({ id: "s1" });
    mocks.update.mockResolvedValue({ id: "s1", coefficient: 5 });
    const updated = await repository.update("s1", { coefficient: 5 });
    expect(updated).toEqual({ id: "s1", coefficient: 5 });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { coefficient: 5 } });
  });

  it("throws SubjectSchemeNotFoundError and never updates a missing scheme", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(repository.update("missing", { coefficient: 5 })).rejects.toThrow(SubjectSchemeNotFoundError);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deletes a scheme that has no recorded grades", async () => {
    mocks.findUnique.mockResolvedValue({ id: "s1" });
    mocks.gradeCount.mockResolvedValue(0);
    await repository.remove("s1");
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("throws SubjectSchemeInUseError and never deletes when grades already reference the scheme", async () => {
    mocks.findUnique.mockResolvedValue({ id: "s1" });
    mocks.gradeCount.mockResolvedValue(3);
    await expect(repository.remove("s1")).rejects.toThrow(SubjectSchemeInUseError);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("throws SubjectSchemeNotFoundError and never checks usage when deleting a missing scheme", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(repository.remove("missing")).rejects.toThrow(SubjectSchemeNotFoundError);
    expect(mocks.gradeCount).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe("subjectCode is immutable after creation", () => {
  it("rejects an update payload that includes subjectCode - it is not an editable field, not just unused", () => {
    const parsed = subjectSchemeUpdateSchema.safeParse({ subjectCode: "XX", nameAr: "الرياضيات" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an update payload that includes series or examYearId for the same reason", () => {
    expect(subjectSchemeUpdateSchema.safeParse({ series: "SN" }).success).toBe(false);
    expect(subjectSchemeUpdateSchema.safeParse({ examYearId: "year-1" }).success).toBe(false);
  });

  it("accepts an update payload containing only the editable fields", () => {
    const parsed = subjectSchemeUpdateSchema.safeParse({ nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 5, displayOrder: 1 });
    expect(parsed.success).toBe(true);
  });
});
