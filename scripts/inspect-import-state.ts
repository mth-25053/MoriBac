import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

async function retry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await operation(); } catch (error) { lastError = error; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1))); }
  }
  throw lastError;
}

async function main() {
  const db = new PrismaClient();
  try {
    const mapping = await retry(() => db.excelMapping.findUnique({ where: { structureKey: process.argv[2] } }));
    const year = await retry(() => db.examYear.findUnique({
      where: { year: Number(process.argv[3]) },
      select: { year: true, isPublished: true, _count: { select: { candidates: true } }, imports: { select: { id: true, checksum: true, status: true, validRows: true, invalidRows: true, createdAt: true } } }
    }));
    console.log(JSON.stringify({ mapping, year }, null, 2));
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });