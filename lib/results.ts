import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { NAME_SEARCH_LIMIT, NAME_SEARCH_MAX_WORDS, PAGE_SIZE } from "@/lib/constants";
import { withDatabaseRetry } from "@/lib/database-retry";

export async function getPublishedYear(requestedYear?: number) {
  return withDatabaseRetry(
    () => requestedYear
      ? db.examYear.findFirst({ where: { year: requestedYear, isPublished: true } })
      : db.examYear.findFirst({ where: { isPublished: true }, orderBy: [{ isDefault: "desc" }, { year: "desc" }] }),
    "published-year-read"
  );
}

/**
 * Cached wrapper for public read paths only - never used by admin mutation code,
 * which always needs the freshest state. Invalidated via revalidateTag("published-year")
 * whenever a year is published/hidden/set-default/deleted, so publish events reflect
 * immediately instead of waiting out the TTL.
 */
export const getPublishedYearCached = unstable_cache(
  (requestedYear?: number) => getPublishedYear(requestedYear),
  ["published-year-cache"],
  { tags: ["published-year"], revalidate: 300 }
);

export async function findCandidateResult(examYearId: string, candidateNumber: string, database = db) {
  return withDatabaseRetry(
    () => database.candidate.findUnique({
      where: { examYearId_candidateNumber: { examYearId, candidateNumber } },
      select: { candidateNumber: true, fullName: true, series: true, average: true, decision: true, wilaya: true, examCenter: true, school: true }
    }),
    "candidate-result-read"
  );
}

export type CandidateRanks = { series: number | null; wilaya: number | null; school: number | null; examCenter: number | null; national: number | null };

/**
 * Numeric rank within each scope (series/wilaya/school/examCenter/national), excluding
 * ANNULE candidates from the pool - mirrors the exclusion rule already used by
 * resultWhere/browseResults. A cancelled candidate never receives a rank in any scope.
 * A scope with no recorded value (missing wilaya/school/examCenter) is reported as null
 * rather than guessed. Reads are sequential, not Promise.all'd: the production pool is
 * a single connection (see getFilterOptions), so a request must not race itself for it.
 */
export async function getCandidateRanks(
  examYearId: string,
  candidate: { series: string; wilaya: string | null; school: string | null; examCenter: string | null; average: number; decision: string },
  database = db
): Promise<CandidateRanks> {
  if (candidate.decision === "ANNULE") return { series: null, wilaya: null, school: null, examCenter: null, national: null };
  return withDatabaseRetry(async () => {
    const ahead = (scope: Prisma.CandidateWhereInput) => database.candidate.count({
      where: { ...scope, examYearId, decision: { not: "ANNULE" }, average: { gt: candidate.average } }
    });
    const series = await ahead({ series: candidate.series });
    const wilaya = candidate.wilaya ? await ahead({ wilaya: candidate.wilaya }) : null;
    const school = candidate.school ? await ahead({ school: candidate.school }) : null;
    const examCenter = candidate.examCenter ? await ahead({ examCenter: candidate.examCenter }) : null;
    const national = await ahead({});
    return {
      series: series + 1,
      wilaya: wilaya === null ? null : wilaya + 1,
      school: school === null ? null : school + 1,
      examCenter: examCenter === null ? null : examCenter + 1,
      national: national + 1
    };
  }, "candidate-ranks-read", { timeoutMs: 20_000 });
}

/**
 * Word-AND substring search over fullName, case-insensitive, tolerant of extra/collapsed
 * whitespace on either side (query words are matched independently, in any order, against
 * whatever spacing the stored name actually has). No new index: at ~50k rows per year a
 * sequential ILIKE scan is cheap, and adding a trigram index would need a schema migration
 * (pg_trgm extension) that isn't justified by this dataset size - see lib/results.ts callers.
 */
export async function searchCandidatesByName(examYearId: string, query: string, database = db) {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, NAME_SEARCH_MAX_WORDS);
  if (words.length === 0) return { candidates: [], hasMore: false };
  return withDatabaseRetry(async () => {
    const rows = await database.candidate.findMany({
      where: { examYearId, AND: words.map((word) => ({ fullName: { contains: word, mode: "insensitive" as const } })) },
      select: { candidateNumber: true, fullName: true, series: true, average: true, decision: true, wilaya: true, examCenter: true, school: true },
      orderBy: [{ fullName: "asc" }, { candidateNumber: "asc" }],
      take: NAME_SEARCH_LIMIT + 1
    });
    return {
      candidates: rows.slice(0, NAME_SEARCH_LIMIT).map((row) => ({ ...row, average: Number(row.average) })),
      hasMore: rows.length > NAME_SEARCH_LIMIT
    };
  }, "candidate-name-search-read", { timeoutMs: 15_000 });
}

function present(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value));
}

/**
 * School and Exam Center are two independent, parallel drill-down paths off
 * Wilaya (not chained through each other) - matches the public rankings UI,
 * where the visitor picks exactly one of the two after selecting a wilaya.
 */
export async function getFilterOptions(examYearId: string, params: { series?: string; wilaya?: string }, database = db) {
  return withDatabaseRetry(async () => {
    const base = { examYearId, decision: { not: "ANNULE" as const } };
    const seriesScope = params.series ? { ...base, series: params.series } : base;

    // The production pool deliberately has one connection. Keep these short reads
    // sequential so a single request cannot exhaust its own pool.
    const seriesRows = await database.candidate.findMany({ where: base, distinct: ["series"], select: { series: true }, orderBy: { series: "asc" } });
    const wilayaRows = await database.candidate.findMany({
      where: { ...seriesScope, wilaya: { not: null } },
      distinct: ["wilaya"],
      select: { wilaya: true },
      orderBy: { wilaya: "asc" }
    });
    if (!params.wilaya) return { series: seriesRows.map((row) => row.series), wilayas: present(wilayaRows.map((row) => row.wilaya)), centers: [], schools: [] };

    const centerRows = await database.candidate.findMany({
      where: { ...seriesScope, wilaya: params.wilaya, examCenter: { not: null } },
      distinct: ["examCenter"],
      select: { examCenter: true },
      orderBy: { examCenter: "asc" }
    });
    const schoolRows = await database.candidate.findMany({
      where: { ...seriesScope, wilaya: params.wilaya, school: { not: null } },
      distinct: ["school"],
      select: { school: true },
      orderBy: { school: "asc" }
    });
    return {
      series: seriesRows.map((row) => row.series),
      wilayas: present(wilayaRows.map((row) => row.wilaya)),
      centers: present(centerRows.map((row) => row.examCenter)),
      schools: present(schoolRows.map((row) => row.school))
    };
  }, "filter-options-read", { timeoutMs: 90_000 });
}

/** Cached wrapper for public read paths. Invalidated via revalidateTag("filter-options") on publish/hide/default/delete and on every completed import. */
export const getFilterOptionsCached = unstable_cache(
  (examYearId: string, params: { series?: string; wilaya?: string }) => getFilterOptions(examYearId, params),
  ["filter-options-cache"],
  { tags: ["filter-options"], revalidate: 300 }
);

/**
 * Ranking scope (no school/center): Top-N by average, excluding ANNULE since a
 * cancelled exam has no meaningful average to rank - mirrors candidateRank's rule.
 * Roster scope (school or center picked): every candidate regardless of decision,
 * so Passed/Resit/Failed/Cancelled/Absent are all visible - this is a full roster,
 * not a leaderboard, so nothing is excluded.
 */
export function resultWhere(examYearId: string, filters: { series: string; wilaya: string; center: string; school: string; name?: string }): Prisma.CandidateWhereInput {
  const detailed = Boolean(filters.center || filters.school);
  const scoped: Prisma.CandidateWhereInput = {
    examYearId,
    ...(detailed ? {} : { decision: { not: "ANNULE" as const } }),
    ...(filters.series ? { series: filters.series } : {}),
    ...(filters.wilaya ? { wilaya: filters.wilaya } : {}),
    ...(filters.name ? { fullName: { contains: filters.name, mode: "insensitive" as const } } : {})
  };
  if (filters.school) return { ...scoped, school: filters.school, ...(filters.center ? { examCenter: filters.center } : {}) };
  if (filters.center) return { ...scoped, examCenter: filters.center };
  return scoped;
}

/** Average, then name, then candidate number as a final deterministic tie-breaker so paginated/ranked order never shifts between two reads. */
export function resultOrder(sort: string): Prisma.CandidateOrderByWithRelationInput[] {
  if (sort === "lowest") return [{ average: "asc" }, { fullName: "asc" }, { candidateNumber: "asc" }];
  if (sort === "name") return [{ fullName: "asc" }, { candidateNumber: "asc" }];
  if (sort === "number") return [{ candidateNumber: "asc" }];
  return [{ average: "desc" }, { fullName: "asc" }, { candidateNumber: "asc" }];
}

export async function browseResults(examYearId: string, filters: { series: string; wilaya: string; center: string; school: string; name?: string; sort: string; page: number }, database = db) {
  return withDatabaseRetry(async () => {
    const where = resultWhere(examYearId, filters);
    const detailed = Boolean(filters.center || filters.school);
    const take = PAGE_SIZE;
    const skip = detailed ? (filters.page - 1) * PAGE_SIZE : 0;
    const candidates = await database.candidate.findMany({
      where,
      orderBy: resultOrder(detailed ? filters.sort : "highest"),
      take,
      skip,
      select: { candidateNumber: true, fullName: true, series: true, average: true, decision: true, wilaya: true, examCenter: true, school: true }
    });
    const total = await database.candidate.count({ where });
    let statistics = null;
    if (detailed) {
      // A single grouped count replaces 5 separate count() round-trips. Any decision value
      // outside the 5 known buckets (e.g. an unmapped raw string) simply has no matching
      // entry below and is - exactly as before - excluded from all 5 buckets while still
      // counted in `total`.
      const decisionCounts = await database.candidate.groupBy({ by: ["decision"], where, _count: { _all: true } });
      const countFor = (decision: string) => decisionCounts.find((row) => row.decision === decision)?._count._all ?? 0;
      const passed = countFor("ADMIS");
      const session = countFor("SESSIONNAIRE");
      const failed = countFor("REDOUBLE");
      const cancelled = countFor("ANNULE");
      const absent = countFor("ABSENT");
      const aggregate = await database.candidate.aggregate({ where, _max: { average: true }, _min: { average: true } });
      statistics = {
        total,
        passed,
        session,
        failed,
        cancelled,
        absent,
        highest: Number(aggregate._max.average ?? 0),
        lowest: Number(aggregate._min.average ?? 0),
        successRate: total ? (passed / total) * 100 : 0
      };
    }
    return {
      candidates: candidates.map((candidate) => ({ ...candidate, average: Number(candidate.average) })),
      total,
      pageCount: detailed ? Math.ceil(total / PAGE_SIZE) : 1,
      statistics
    };
  }, "browse-results-read", { timeoutMs: 120_000 });
}

/** Cached wrapper for the public browse/rankings/statistics read path. Same invalidation tag as getFilterOptionsCached. */
export const browseResultsCached = unstable_cache(
  (examYearId: string, filters: { series: string; wilaya: string; center: string; school: string; name?: string; sort: string; page: number }) => browseResults(examYearId, filters),
  ["browse-results-cache"],
  { tags: ["filter-options"], revalidate: 60 }
);

/**
 * Server-side data for the dedicated /schools/[school] and /centers/[center] pages -
 * resolves the requested (or default) published year and loads page 1 of that single
 * school/center's roster + statistics, so the page has real content on first paint
 * instead of a client-side loading state. Returns null when there is no published year
 * to serve (invalid year param, or nothing published yet) - the caller renders a graceful
 * empty state rather than a 404, since the route itself is valid.
 */
export async function getRosterInitialData(kind: "school" | "center", name: string, filters: { year?: number; wilaya: string; series: string }) {
  const year = await getPublishedYearCached(filters.year);
  if (!year) return null;
  const data = await browseResultsCached(year.id, {
    series: filters.series,
    wilaya: filters.wilaya,
    school: kind === "school" ? name : "",
    center: kind === "center" ? name : "",
    sort: "highest",
    page: 1
  });
  return { year: year.year, ...data };
}