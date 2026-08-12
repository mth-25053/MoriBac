import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import type { CandidateLookup, SubjectSchemeLookup } from "@/lib/grades/validate";

const PRELOAD_CHUNK_SIZE = 2000;

function cacheKey(examYear: number, examType: string, candidateNumber: string) {
  return `${examYear} ${examType} ${candidateNumber}`;
}

/**
 * Prisma-backed CandidateLookup. validateGradeRows calls find() once per
 * distinct candidate in the batch (it has its own internal cache), but for a
 * 500,000+ row file that's still tens of thousands of individual awaited
 * queries if done one at a time. preload() bulk-fetches every candidate the
 * caller already knows it will ask about, in chunks, so find() becomes a
 * cache read for the whole run instead of a per-candidate round trip.
 */
export class PrismaCandidateLookup implements CandidateLookup {
  private readonly yearIdCache = new Map<number, string | null>();
  private readonly candidateCache = new Map<string, { id: string; series: string } | null>();

  constructor(private readonly database = db) {}

  private async resolveYearId(examYear: number) {
    if (this.yearIdCache.has(examYear)) return this.yearIdCache.get(examYear) ?? null;
    const year = await withDatabaseRetry(
      () => this.database.examYear.findUnique({ where: { year_session: { year: examYear, session: "NORMAL" } }, select: { id: true } }),
      "grade-import-year-lookup",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    const id = year?.id ?? null;
    this.yearIdCache.set(examYear, id);
    return id;
  }

  async preload(examYear: number, examType: string, candidateNumbers: string[]) {
    const examYearId = await this.resolveYearId(examYear);
    if (!examYearId) return;
    const unique = [...new Set(candidateNumbers)];
    for (let index = 0; index < unique.length; index += PRELOAD_CHUNK_SIZE) {
      const slice = unique.slice(index, index + PRELOAD_CHUNK_SIZE);
      const found = await withDatabaseRetry(
        () => this.database.candidate.findMany({
          where: { examYearId, candidateNumber: { in: slice } },
          select: { id: true, series: true, candidateNumber: true }
        }),
        "grade-import-candidate-preload",
        { maxAttempts: 3, timeoutMs: 30_000 }
      );
      const foundByNumber = new Map(found.map((candidate) => [candidate.candidateNumber, { id: candidate.id, series: candidate.series }]));
      for (const number of slice) {
        this.candidateCache.set(cacheKey(examYear, examType, number), foundByNumber.get(number) ?? null);
      }
    }
  }

  async find(input: { examYear: number; examType: string; candidateNumber: string }) {
    const key = cacheKey(input.examYear, input.examType, input.candidateNumber);
    if (this.candidateCache.has(key)) return this.candidateCache.get(key) ?? null;
    const examYearId = await this.resolveYearId(input.examYear);
    if (!examYearId) return null;
    const candidate = await withDatabaseRetry(
      () => this.database.candidate.findUnique({
        where: { examYearId_candidateNumber: { examYearId, candidateNumber: input.candidateNumber } },
        select: { id: true, series: true }
      }),
      "grade-import-candidate-lookup",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    this.candidateCache.set(key, candidate);
    return candidate;
  }
}

export class PrismaSubjectSchemeLookup implements SubjectSchemeLookup {
  private readonly cache = new Map<string, { series: string; subjectCode: string }[]>();

  constructor(private readonly database = db) {}

  async listByYear(input: { examYear: number; examType: string }) {
    const key = `${input.examYear} ${input.examType}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const examYear = await withDatabaseRetry(
      () => this.database.examYear.findUnique({ where: { year_session: { year: input.examYear, session: "NORMAL" } }, select: { id: true } }),
      "grade-import-scheme-year-lookup",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (!examYear) {
      this.cache.set(key, []);
      return [];
    }
    const schemes = await withDatabaseRetry(
      () => this.database.subjectScheme.findMany({
        where: { examYearId: examYear.id, examType: input.examType },
        select: { series: true, subjectCode: true }
      }),
      "grade-import-scheme-list",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    this.cache.set(key, schemes);
    return schemes;
  }
}

/**
 * Resolves each importable row's subjectCode to the actual SubjectScheme row id
 * it must be stored against - validateGradeRows only needed to confirm the code
 * exists for the series, not its id, so this is a separate, one-time lookup done
 * right before writing, not part of the Phase 2 validation contract.
 */
export async function resolveSubjectSchemeIds(examYearId: string, examType: string, rows: { series: string; subjectCode: string }[]) {
  const schemes = await withDatabaseRetry(
    () => db.subjectScheme.findMany({ where: { examYearId, examType }, select: { id: true, series: true, subjectCode: true } }),
    "grade-import-scheme-id-resolve",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
  const idBySeriesAndCode = new Map(schemes.map((scheme) => [`${scheme.series} ${scheme.subjectCode}`, scheme.id]));
  return rows.map((row) => {
    const id = idBySeriesAndCode.get(`${row.series} ${row.subjectCode}`);
    if (!id) throw new Error(`SUBJECT_SCHEME_ID_MISSING:${row.series}:${row.subjectCode}`);
    return id;
  });
}
