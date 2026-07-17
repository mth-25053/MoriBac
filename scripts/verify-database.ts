import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function queryState() {
  const db = new PrismaClient();
  try {
    const year = await db.examYear.findUnique({ where: { year: 2025 } });
    if (!year) throw new Error("YEAR_NOT_FOUND");
    const [count, batch] = await Promise.all([
      db.candidate.count({ where: { examYearId: year.id } }),
      db.importBatch.findFirst({
        where: { examYearId: year.id, status: "IMPORTED" },
        orderBy: { createdAt: "desc" },
        select: { status: true }
      })
    ]);
    return {
      id: year.id,
      count,
      published: year.isPublished,
      isDefault: year.isDefault,
      batchStatus: batch?.status ?? null
    };
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const state = await queryState();
      if (state.count !== 53_148) throw new Error(`EXPECTED_53148_CANDIDATES_GOT_${state.count}`);
      if (state.batchStatus !== "IMPORTED") throw new Error("IMPORT_BATCH_NOT_COMPLETED");
      if (!state.published || !state.isDefault) throw new Error("BAC_2025_NOT_PUBLISHED_AS_DEFAULT");
      console.log(JSON.stringify(state));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await wait(attempt * 1_500);
    }
  }
  throw lastError;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DATABASE_VERIFICATION_FAILED");
  process.exitCode = 1;
});