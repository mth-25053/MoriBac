import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");

const expected = new Map([
  [2021, { count: 46_587, cancelled: 767, published: true, isDefault: false }],
  [2024, { count: 47_217, cancelled: 0, published: true, isDefault: true }],
  [2025, { count: 53_148, cancelled: 335, published: true, isDefault: false }]
]);

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

async function queryState() {
  const db = new PrismaClient();
  try {
    const years = await db.examYear.findMany({
      where: { year: { in: [...expected.keys()] } },
      orderBy: { year: "asc" },
      select: {
        id: true,
        year: true,
        isPublished: true,
        isDefault: true,
        _count: { select: { candidates: true } },
        imports: {
          where: { status: "IMPORTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, totalRows: true, validRows: true, invalidRows: true }
        }
      }
    });
    const states = [];
    for (const year of years) {
      const cancelled = await db.candidate.count({ where: { examYearId: year.id, decision: "ANNULE" } });
      states.push({ year: year.year, isPublished: year.isPublished, isDefault: year.isDefault, _count: year._count, imports: year.imports, cancelled });
    }
    return states;
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const years = await retry(queryState);
  if (years.length !== expected.size) throw new Error("EXPECTED_PRODUCTION_YEARS_NOT_FOUND");
  for (const year of years) {
    const target = expected.get(year.year);
    if (!target) throw new Error(`UNEXPECTED_YEAR_${year.year}`);
    if (year._count.candidates !== target.count) throw new Error(`YEAR_${year.year}_EXPECTED_${target.count}_GOT_${year._count.candidates}`);
    if (year.cancelled !== target.cancelled) throw new Error(`YEAR_${year.year}_EXPECTED_${target.cancelled}_CANCELLED_GOT_${year.cancelled}`);
    if (year.isPublished !== target.published || year.isDefault !== target.isDefault) throw new Error(`YEAR_${year.year}_PUBLICATION_STATE_MISMATCH`);
    const batch = year.imports[0];
    if (!batch || batch.status !== "IMPORTED" || batch.validRows !== target.count || batch.invalidRows !== 0 || batch.totalRows !== target.count) throw new Error(`YEAR_${year.year}_IMPORT_BATCH_MISMATCH`);
  }
  console.log(JSON.stringify(years));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DATABASE_VERIFICATION_FAILED");
  process.exitCode = 1;
});