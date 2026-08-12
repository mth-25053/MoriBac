import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) {
  const url = new URL(process.env.DIRECT_URL);
  url.searchParams.set("connection_limit", "5");
  url.searchParams.set("pool_timeout", "30");
  process.env.DATABASE_URL = url.toString();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const yearNumber = Number(process.argv[2]);
  const db = new PrismaClient();
  try {
    const { browseResults, findCandidateResult } = await import("../lib/results");
    const year = await db.examYear.findUnique({ where: { year_session: { year: yearNumber, session: "NORMAL" } } });
    assert(year, "Exam year does not exist");
    const sample = await db.candidate.findFirst({
      where: { examYearId: year.id, wilaya: { not: null }, examCenter: { not: null }, school: { not: null } },
      orderBy: { candidateNumber: "asc" }
    });
    assert(sample && sample.wilaya && sample.examCenter && sample.school, "No complete sample candidate exists");

    const search = await findCandidateResult(year.id, sample.candidateNumber, db);
    assert(search?.candidateNumber === sample.candidateNumber && search.fullName === sample.fullName && Number(search.average) === Number(sample.average), "Candidate search failed");

    const series = await db.candidate.findMany({ where: { examYearId: year.id }, distinct: ["series"], select: { series: true }, orderBy: { series: "asc" } });
    const top10: Record<string, number> = {};
    for (const item of series) {
      const result = await browseResults(year.id, { series: item.series, wilaya: "", center: "", school: "", sort: "highest", page: 1 }, db);
      assert(result.candidates.length === Math.min(10, result.total), "Top 10 count failed for " + item.series);
      assert(result.candidates.every((row) => row.series === item.series), "Top 10 series failed for " + item.series);
      assert(result.candidates.every((row) => row.decision !== "ANNULE"), "ANNULE appeared in Top 10 for " + item.series);
      assert(result.candidates.every((row, index, rows) => index === 0 || rows[index - 1].average >= row.average), "Top 10 order failed for " + item.series);
      top10[item.series] = result.candidates.length;
    }

    const center = await browseResults(year.id, { series: "IGNORED", wilaya: sample.wilaya, center: sample.examCenter, school: "", sort: "highest", page: 1 }, db);
    assert(center.total > 0 && center.candidates.every((row) => row.examCenter === sample.examCenter), "Center browse failed");
    assert(center.pageCount === Math.ceil(center.total / 50) && center.statistics?.total === center.total, "Center statistics failed");

    const school = await browseResults(year.id, { series: "IGNORED", wilaya: sample.wilaya, center: sample.examCenter, school: sample.school, sort: "highest", page: 1 }, db);
    assert(school.total > 0 && school.candidates.every((row) => row.school === sample.school), "School browse failed");
    assert(school.pageCount === Math.ceil(school.total / 50) && school.statistics?.total === school.total, "School statistics failed");

    console.log(JSON.stringify({
      year: yearNumber,
      publishedStateUnchanged: year.isPublished,
      candidateSearch: sample.candidateNumber,
      filterOptions: true,
      top10,
      center: { name: sample.examCenter, total: center.total, pageRows: center.candidates.length },
      school: { name: sample.school, total: school.total, pageRows: school.candidates.length }
    }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});