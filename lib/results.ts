import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/constants";
import { withDatabaseRetry } from "@/lib/database-retry";

export async function getPublishedYear(requestedYear?: number) {
  return withDatabaseRetry(
    () => requestedYear
      ? db.examYear.findFirst({ where: { year: requestedYear, isPublished: true } })
      : db.examYear.findFirst({ where: { isPublished: true }, orderBy: [{ isDefault: "desc" }, { year: "desc" }] }),
    "published-year-read"
  );
}

export async function findCandidateResult(examYearId: string, candidateNumber: string, database = db) {
  return withDatabaseRetry(
    () => database.candidate.findUnique({
      where: { examYearId_candidateNumber: { examYearId, candidateNumber } },
      select: { candidateNumber: true, fullName: true, series: true, average: true, decision: true, wilaya: true, examCenter: true, school: true }
    }),
    "candidate-result-read"
  );
}

function present(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value));
}

export async function getFilterOptions(examYearId: string, params: { series?: string; wilaya?: string; center?: string }, database = db) {
  return withDatabaseRetry(async () => {
    const base = { examYearId, decision: { not: "ANNULE" as const } };
    const seriesRows = await database.candidate.findMany({ where: base, distinct: ["series"], select: { series: true }, orderBy: { series: "asc" } });
    if (!params.series) return { series: seriesRows.map((row) => row.series), wilayas: [], centers: [], schools: [] };

    // The production pool deliberately has one connection. Keep these short reads
    // sequential so a single request cannot exhaust its own pool.
    const wilayaRows = await database.candidate.findMany({
      where: { ...base, wilaya: { not: null } },
      distinct: ["wilaya"],
      select: { wilaya: true },
      orderBy: { wilaya: "asc" }
    });
    const centerRows = params.wilaya
      ? await database.candidate.findMany({
          where: { ...base, wilaya: params.wilaya, examCenter: { not: null } },
          distinct: ["examCenter"],
          select: { examCenter: true },
          orderBy: { examCenter: "asc" }
        })
      : [];
    const schoolRows = params.center
      ? await database.candidate.findMany({
          where: { ...base, examCenter: params.center, school: { not: null }, ...(params.wilaya ? { wilaya: params.wilaya } : {}) },
          distinct: ["school"],
          select: { school: true },
          orderBy: { school: "asc" }
        })
      : [];
    return {
      series: seriesRows.map((row) => row.series),
      wilayas: present(wilayaRows.map((row) => row.wilaya)),
      centers: present(centerRows.map((row) => row.examCenter)),
      schools: present(schoolRows.map((row) => row.school))
    };
  }, "filter-options-read", { timeoutMs: 90_000 });
}

export function resultWhere(examYearId: string, filters: { series: string; wilaya: string; center: string; school: string }): Prisma.CandidateWhereInput | null {
  const rankable = { examYearId, decision: { not: "ANNULE" as const } };
  if (filters.school) return { ...rankable, school: filters.school, ...(filters.center ? { examCenter: filters.center } : {}), ...(filters.wilaya ? { wilaya: filters.wilaya } : {}) };
  if (filters.center) return { ...rankable, examCenter: filters.center, ...(filters.wilaya ? { wilaya: filters.wilaya } : {}) };
  if (filters.series) return { ...rankable, series: filters.series };
  return null;
}

export function resultOrder(sort: string): Prisma.CandidateOrderByWithRelationInput[] {
  if (sort === "lowest") return [{ average: "asc" }, { fullName: "asc" }];
  if (sort === "name") return [{ fullName: "asc" }, { candidateNumber: "asc" }];
  if (sort === "number") return [{ candidateNumber: "asc" }];
  return [{ average: "desc" }, { fullName: "asc" }];
}

export async function browseResults(examYearId: string, filters: { series: string; wilaya: string; center: string; school: string; sort: string; page: number }, database = db) {
  return withDatabaseRetry(async () => {
    const where = resultWhere(examYearId, filters);
    if (!where) return { candidates: [], total: 0, pageCount: 0, statistics: null };
    const detailed = Boolean(filters.center || filters.school);
    const take = detailed ? PAGE_SIZE : 10;
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
      const passed = await database.candidate.count({ where: { AND: [where, { decision: "ADMIS" }] } });
      const session = await database.candidate.count({ where: { AND: [where, { decision: "SESSIONNAIRE" }] } });
      const failed = await database.candidate.count({ where: { AND: [where, { decision: "REDOUBLE" }] } });
      const aggregate = await database.candidate.aggregate({ where, _max: { average: true } });
      statistics = { total, passed, session, failed, highest: Number(aggregate._max.average ?? 0), successRate: total ? (passed / total) * 100 : 0 };
    }
    return {
      candidates: candidates.map((candidate) => ({ ...candidate, average: Number(candidate.average) })),
      total,
      pageCount: detailed ? Math.ceil(total / PAGE_SIZE) : 1,
      statistics
    };
  }, "browse-results-read", { timeoutMs: 120_000 });
}