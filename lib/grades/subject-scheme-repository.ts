import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";

export type SubjectSchemeInput = {
  examYearId: string;
  examType: string;
  series: string;
  subjectCode: string;
  nameAr: string | null;
  nameFr: string | null;
  coefficient: number | null;
  displayOrder: number;
};

export type SubjectSchemeUpdateInput = {
  nameAr?: string | null;
  nameFr?: string | null;
  coefficient?: number | null;
  displayOrder?: number;
};

export class DuplicateSubjectSchemeError extends Error {
  constructor(readonly examType: string, readonly series: string, readonly subjectCode: string) {
    super(`DUPLICATE_SUBJECT_SCHEME:${examType}:${series}:${subjectCode}`);
    this.name = "DuplicateSubjectSchemeError";
  }
}

export class SubjectSchemeInUseError extends Error {
  constructor(readonly id: string) {
    super(`SUBJECT_SCHEME_IN_USE:${id}`);
    this.name = "SubjectSchemeInUseError";
  }
}

export class SubjectSchemeNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`SUBJECT_SCHEME_NOT_FOUND:${id}`);
    this.name = "SubjectSchemeNotFoundError";
  }
}

/** Prisma Decimal -> plain number for API responses, same convention as lib/format.ts's serializeCandidate. */
export function serializeSubjectScheme<T extends { coefficient: unknown }>(scheme: T) {
  return { ...scheme, coefficient: scheme.coefficient === null || scheme.coefficient === undefined ? null : Number(scheme.coefficient) };
}

/**
 * CRUD over SubjectScheme - deliberately plain create/update/delete, no version
 * field, no active/inactive toggle: the architecture keeps one immutable
 * identity per (examYearId, examType, series, subjectCode) by design. Business
 * errors (duplicate identity, in-use on delete, missing row) are raised from
 * explicit pre-checks rather than caught Prisma error codes, matching how
 * DuplicateCandidateError is raised in lib/import-batches.ts.
 */
export class SubjectSchemeRepository {
  constructor(private readonly database = db) {}

  async list(examYearId: string, examType = "bac") {
    return withDatabaseRetry(
      () => this.database.subjectScheme.findMany({
        where: { examYearId, examType },
        orderBy: [{ series: "asc" }, { displayOrder: "asc" }]
      }),
      "subject-scheme-list",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async create(input: SubjectSchemeInput) {
    const existing = await withDatabaseRetry(
      () => this.database.subjectScheme.findUnique({
        where: {
          examYearId_examType_series_subjectCode: {
            examYearId: input.examYearId,
            examType: input.examType,
            series: input.series,
            subjectCode: input.subjectCode
          }
        }
      }),
      "subject-scheme-duplicate-check",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (existing) throw new DuplicateSubjectSchemeError(input.examType, input.series, input.subjectCode);
    return withDatabaseRetry(
      () => this.database.subjectScheme.create({ data: input }),
      "subject-scheme-create",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async update(id: string, input: SubjectSchemeUpdateInput) {
    const existing = await withDatabaseRetry(
      () => this.database.subjectScheme.findUnique({ where: { id } }),
      "subject-scheme-read",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (!existing) throw new SubjectSchemeNotFoundError(id);
    return withDatabaseRetry(
      () => this.database.subjectScheme.update({ where: { id }, data: input }),
      "subject-scheme-update",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async remove(id: string) {
    const existing = await withDatabaseRetry(
      () => this.database.subjectScheme.findUnique({ where: { id } }),
      "subject-scheme-read",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (!existing) throw new SubjectSchemeNotFoundError(id);
    const inUse = await withDatabaseRetry(
      () => this.database.candidateSubjectGrade.count({ where: { subjectSchemeId: id } }),
      "subject-scheme-usage-check",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (inUse > 0) throw new SubjectSchemeInUseError(id);
    await withDatabaseRetry(
      () => this.database.subjectScheme.delete({ where: { id } }),
      "subject-scheme-delete",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    return existing;
  }
}
