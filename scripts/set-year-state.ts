import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const yearNumber = Number(process.argv[2]);
const published = process.argv[3] === "true";

async function main() {
  const db = new PrismaClient();
  let lastError: unknown;
  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const year = await db.examYear.update({ where: { year_session: { year: yearNumber, session: "NORMAL" } }, data: { isPublished: published } });
        console.log(JSON.stringify({ year: year.year, isPublished: year.isPublished }));
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      }
    }
    throw lastError;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});