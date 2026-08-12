import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { Prisma, PrismaClient } from "@prisma/client";
import { inspectExcel, parseExcel } from "../lib/excel";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const filePath = process.argv[2];
const yearNumber = Number(process.argv[3]);
const inputBase = process.argv[4] || "http://localhost:3000";
const base = inputBase.endsWith("/") ? inputBase.slice(0, -1) : inputBase;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(110_000) });
      const text = await response.text();
      if (!response.ok) throw new Error(path + " returned " + response.status + ": " + text);
      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

function stringSet(values: Array<string | null>) {
  return new Set(values.filter((value): value is string => value !== null));
}

function sameSet(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

type PublicCandidate = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: string;
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
  birthDate?: unknown;
  birthPlace?: unknown;
};

type ResultsResponse = {
  candidates: PublicCandidate[];
  total: number;
  pageCount: number;
  statistics: null | { total: number };
};

async function databaseRetry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
async function main() {
  assert(filePath && Number.isInteger(yearNumber), "Usage: tsx scripts/verify-workbook-import.ts <file.xlsx> <year> [base-url]");
  const buffer = await readFile(filePath);
  const inspection = await inspectExcel(buffer);
  const parsed = await parseExcel(buffer);
  assert(parsed.invalidRows === 0, "Local workbook validation is no longer clean");

  const db = new PrismaClient();
  let originalPublished: boolean | undefined;
  try {
    const year = await db.examYear.findUnique({ where: { year_session: { year: yearNumber, session: "NORMAL" } } });
    assert(year, "Imported exam year does not exist");
    originalPublished = year.isPublished;
    console.log("VERIFY_STAGE database-row-comparison");
    const candidateSelect = {
      candidateNumber: true,
      fullName: true,
      series: true,
      average: true,
      decision: true,
      wilaya: true,
      examCenter: true,
      school: true,
      birthDate: true,
      birthPlace: true,
      candidateType: true,
      importBatchId: true
    } satisfies Prisma.CandidateSelect;
    type StoredCandidate = Prisma.CandidateGetPayload<{ select: typeof candidateSelect }>;
    const stored: StoredCandidate[] = [];
    for (let skip = 0; ; skip += 2_000) {
      const page = await databaseRetry(() => db.candidate.findMany({
        where: { examYearId: year.id },
        select: candidateSelect,
        orderBy: { candidateNumber: "asc" },
        skip,
        take: 2_000
      }));
      stored.push(...page);
      if (page.length < 2_000) break;
    }
    assert(stored.length === parsed.validRows, "Database count differs from workbook");
    const byNumber = new Map(stored.map((row) => [row.candidateNumber, row]));
    assert(byNumber.size === stored.length, "Duplicate candidate numbers exist");

    for (const expected of parsed.rows) {
      const actual = byNumber.get(expected.candidateNumber);
      assert(actual, "Missing candidate " + expected.candidateNumber);
      assert(
        actual.fullName === expected.fullName
          && actual.series === expected.series
          && Number(actual.average) === expected.average
          && actual.decision === expected.decision
          && actual.wilaya === expected.wilaya
          && actual.examCenter === expected.examCenter
          && actual.school === expected.school
          && actual.birthDate === expected.birthDate
          && actual.birthPlace === expected.birthPlace
          && actual.candidateType === expected.candidateType,
        "Field mismatch for candidate " + expected.candidateNumber
      );
    }

    const workbookWilayas = stringSet(parsed.rows.map((row) => row.wilaya));
    const workbookCenters = stringSet(parsed.rows.map((row) => row.examCenter));
    const workbookSchools = stringSet(parsed.rows.map((row) => row.school));
    const databaseWilayas = stringSet(stored.map((row) => row.wilaya));
    const databaseCenters = stringSet(stored.map((row) => row.examCenter));
    const databaseSchools = stringSet(stored.map((row) => row.school));
    assert(sameSet(workbookWilayas, databaseWilayas), "Wilaya values differ");
    assert(sameSet(workbookCenters, databaseCenters), "Exam center values differ");
    assert(sameSet(workbookSchools, databaseSchools), "School values differ");

    const batchIds = new Set(stored.map((row) => row.importBatchId));
    assert(batchIds.size === 1, "Candidates span more than one import batch");
    const batch = await db.importBatch.findUnique({ where: { id: [...batchIds][0] } });
    assert(batch?.status === "IMPORTED" && batch.validRows === stored.length && batch.invalidRows === 0, "Import batch integrity failed");
    const savedMapping = await db.excelMapping.findUnique({ where: { structureKey: inspection.structureKey } });
    assert(savedMapping, "Detected column mapping was not saved");

    console.log("VERIFY_STAGE public-api");
    if (!year.isPublished) await db.examYear.update({ where: { id: year.id }, data: { isPublished: true } });

    const sample = parsed.rows.find((row) => row.examCenter && row.school) ?? parsed.rows[0];
    const search = await getJson<{ candidate: PublicCandidate | null; year: number }>("/api/public/search?" + new URLSearchParams({ number: sample.candidateNumber, year: String(yearNumber) }));
    assert(search.candidate, "Candidate search returned no result");
    assert(search.candidate.candidateNumber === sample.candidateNumber && search.candidate.fullName === sample.fullName && search.candidate.average === sample.average, "Candidate search result differs");
    assert(!("birthDate" in search.candidate) && !("birthPlace" in search.candidate), "Public search exposed birth data");

    const meta = await getJson<{ year: number | null; options: { series: string[] } }>("/api/public/meta?year=" + yearNumber);
    const seriesValues = [...new Set(parsed.rows.map((row) => row.series))].sort();
    assert(meta.year === yearNumber && sameSet(new Set(meta.options.series), new Set(seriesValues)), "Series metadata differs");

    const top10: Record<string, number> = {};
    for (const series of seriesValues) {
      const result = await getJson<ResultsResponse>("/api/public/results?" + new URLSearchParams({ year: String(yearNumber), series }));
      assert(result.candidates.length === Math.min(10, result.total), "Top 10 count failed for " + series);
      assert(result.candidates.every((row) => row.series === series), "Series filter failed for " + series);
      assert(result.candidates.every((row) => row.decision !== "ANNULE"), "ANNULE appeared in Top 10 for " + series);
      assert(result.candidates.every((row, index, rows) => index === 0 || rows[index - 1].average >= row.average), "Top 10 order failed for " + series);
      top10[series] = result.candidates.length;
    }

    assert(sample.wilaya && sample.examCenter && sample.school, "No complete browse sample exists");
    const center = await getJson<ResultsResponse>("/api/public/results?" + new URLSearchParams({
      year: String(yearNumber), series: "IGNORED", wilaya: sample.wilaya, center: sample.examCenter, page: "1", sort: "highest"
    }));
    assert(center.total > 0 && center.candidates.every((row) => row.examCenter === sample.examCenter), "Center browsing failed");
    assert(center.pageCount === Math.ceil(center.total / 50) && center.statistics?.total === center.total, "Center pagination/statistics failed");

    const school = await getJson<ResultsResponse>("/api/public/results?" + new URLSearchParams({
      year: String(yearNumber), series: "IGNORED", wilaya: sample.wilaya, center: sample.examCenter, school: sample.school, page: "1", sort: "highest"
    }));
    assert(school.total > 0 && school.candidates.every((row) => row.school === sample.school), "School browsing failed");
    assert(school.pageCount === Math.ceil(school.total / 50) && school.statistics?.total === school.total, "School pagination/statistics failed");

    const averages = parsed.rows.map((row) => row.average);
    const decisions = Object.fromEntries(["ADMIS", "SESSIONNAIRE", "REDOUBLE", "ABSENT", "ANNULE"].map((decision) => [
      decision,
      parsed.rows.filter((row) => row.decision === decision).length
    ]));
    console.log(JSON.stringify({
      year: yearNumber,
      checksum: parsed.checksum,
      candidates: stored.length,
      duplicates: stored.length - byNumber.size,
      allRowsFieldMatched: true,
      averages: { min: Math.min(...averages), max: Math.max(...averages), allMatched: true },
      decisions,
      distinct: { wilayas: databaseWilayas.size, examCenters: databaseCenters.size, schools: databaseSchools.size },
      mappingSaved: true,
      candidateSearch: { number: sample.candidateNumber, ok: true },
      top10,
      centerBrowse: { value: sample.examCenter, total: center.total, pageRows: center.candidates.length, ok: true },
      schoolBrowse: { value: sample.school, total: school.total, pageRows: school.candidates.length, ok: true },
      publicBirthDataHidden: true,
      finalPublishedState: originalPublished
    }, null, 2));
  } finally {
    if (originalPublished !== undefined) {
      const year = await db.examYear.findUnique({ where: { year_session: { year: yearNumber, session: "NORMAL" } } });
      if (year && year.isPublished !== originalPublished) {
        await db.examYear.update({ where: { id: year.id }, data: { isPublished: originalPublished } });
      }
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});