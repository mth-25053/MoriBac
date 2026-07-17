import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

async function main() {
  const year = Number(process.argv[2]);
  const number = process.argv[3];
  const db = new PrismaClient();
  try {
    const examYear = await db.examYear.findUnique({ where: { year } });
    const candidate = examYear ? await db.candidate.findUnique({
      where: { examYearId_candidateNumber: { examYearId: examYear.id, candidateNumber: number } }
    }) : null;
    console.log(JSON.stringify(candidate, (_, value) =>
      typeof value === "object" && value && value.constructor?.name === "Decimal" ? Number(value) : value, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});