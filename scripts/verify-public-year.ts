import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const yearNumber = Number(process.argv[2]);
const inputBase = process.argv[3] || "http://localhost:3000";
const base = inputBase.endsWith("/") ? inputBase.slice(0, -1) : inputBase;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function retry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function getJson<T>(path: string): Promise<T> {
  return retry(async () => {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(120_000) });
    const body = await response.text();
    if (!response.ok) throw new Error(path + " returned " + response.status + ": " + body);
    return JSON.parse(body) as T;
  });
}

type Candidate = {
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

type Results = {
  candidates: Candidate[];
  total: number;
  pageCount: number;
  statistics: null | { total: number };
};

async function main() {
  assert(Number.isInteger(yearNumber), "Usage: tsx scripts/verify-public-year.ts <year> [base-url]");
  const db = new PrismaClient();
  let yearId = "";
  let originalPublished = false;
  try {
    const year = await retry(() => db.examYear.findUnique({ where: { year: yearNumber } }));
    assert(year, "Exam year does not exist");
    yearId = year.id;
    originalPublished = year.isPublished;
    const sample = await retry(() => db.candidate.findFirst({
      where: { examYearId: year.id, wilaya: { not: null }, examCenter: { not: null }, school: { not: null } },
      orderBy: { candidateNumber: "asc" }
    }));
    assert(sample, "No complete candidate exists");
    if (!originalPublished) await retry(() => db.examYear.update({ where: { id: year.id }, data: { isPublished: true } }));

    console.log("PUBLIC_STAGE candidate-search");
    const search = await getJson<{ candidate: Candidate | null; year: number }>("/api/public/search?" + new URLSearchParams({ number: sample.candidateNumber, year: String(yearNumber) }));
    assert(search.candidate, "Candidate search returned no result");
    assert(search.candidate.candidateNumber === sample.candidateNumber && search.candidate.fullName === sample.fullName && search.candidate.average === Number(sample.average), "Candidate search mismatch");
    assert(!("birthDate" in search.candidate) && !("birthPlace" in search.candidate), "Public search exposed birth data");

    console.log("PUBLIC_STAGE top10");
    const meta = await getJson<{ year: number | null; options: { series: string[] } }>("/api/public/meta?year=" + yearNumber);
    assert(meta.year === yearNumber && meta.options.series.length > 0, "Series metadata failed");
    const top10: Record<string, number> = {};
    for (const series of meta.options.series) {
      const result = await getJson<Results>("/api/public/results?" + new URLSearchParams({ year: String(yearNumber), series }));
      assert(result.candidates.length === Math.min(10, result.total), "Top 10 count failed for " + series);
      assert(result.candidates.every((row) => row.series === series), "Series filter failed for " + series);
      assert(result.candidates.every((row, index, rows) => index === 0 || rows[index - 1].average >= row.average), "Top 10 order failed for " + series);
      top10[series] = result.candidates.length;
    }

    assert(sample.wilaya && sample.examCenter && sample.school, "Sample browse fields missing");
    console.log("PUBLIC_STAGE center");
    const center = await getJson<Results>("/api/public/results?" + new URLSearchParams({
      year: String(yearNumber), series: "IGNORED", wilaya: sample.wilaya, center: sample.examCenter, page: "1", sort: "highest"
    }));
    assert(center.total > 0 && center.candidates.every((row) => row.examCenter === sample.examCenter), "Center browse failed");
    assert(center.pageCount === Math.ceil(center.total / 50) && center.statistics?.total === center.total, "Center pagination/statistics failed");

    console.log("PUBLIC_STAGE school");
    const school = await getJson<Results>("/api/public/results?" + new URLSearchParams({
      year: String(yearNumber), series: "IGNORED", wilaya: sample.wilaya, center: sample.examCenter, school: sample.school, page: "1", sort: "highest"
    }));
    assert(school.total > 0 && school.candidates.every((row) => row.school === sample.school), "School browse failed");
    assert(school.pageCount === Math.ceil(school.total / 50) && school.statistics?.total === school.total, "School pagination/statistics failed");

    console.log(JSON.stringify({
      year: yearNumber,
      candidateSearch: sample.candidateNumber,
      top10,
      center: { name: sample.examCenter, total: center.total, pageRows: center.candidates.length },
      school: { name: sample.school, total: school.total, pageRows: school.candidates.length },
      birthDataHidden: true,
      restoredPublishedState: originalPublished
    }, null, 2));
  } finally {
    if (yearId) {
      await retry(async () => {
        const current = await db.examYear.findUnique({ where: { id: yearId } });
        if (current && current.isPublished !== originalPublished) await db.examYear.update({ where: { id: yearId }, data: { isPublished: originalPublished } });
      });
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});