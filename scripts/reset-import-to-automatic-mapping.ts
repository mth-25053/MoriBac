import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { Prisma, PrismaClient } from "@prisma/client";
import { inspectExcel, parseExcel } from "../lib/excel";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  const filePath = process.argv[2];
  const yearNumber = Number(process.argv[3]);
  const buffer = await readFile(filePath);
  const inspection = await inspectExcel(buffer);
  const report = await parseExcel(buffer);
  if (inspection.unresolvedRequired.length || report.invalidRows) throw new Error("Automatic mapping is not fully valid");

  const db = new PrismaClient();
  try {
    const year = await db.examYear.findUnique({ where: { year_session: { year: yearNumber, session: "NORMAL" } } });
    if (!year) throw new Error("Exam year does not exist");
    const batch = await db.importBatch.findUnique({ where: { checksum: report.checksum } });
    if (!batch || batch.examYearId !== year.id || batch.status !== "IMPORTED") throw new Error("Imported batch does not match this workbook and year");
    const candidateCount = await db.candidate.count({ where: { examYearId: year.id, importBatchId: batch.id } });
    if (candidateCount !== report.validRows) throw new Error("Refusing rollback because batch count differs from workbook");

    await db.$transaction(async (tx) => {
      await tx.candidate.deleteMany({ where: { examYearId: year.id, importBatchId: batch.id } });
      await tx.importBatch.delete({ where: { id: batch.id } });
      await tx.excelMapping.upsert({
        where: { structureKey: inspection.structureKey },
        create: {
          structureKey: inspection.structureKey,
          sheetName: inspection.sheetName,
          headerRow: inspection.headerRow,
          headers: json(inspection.columns),
          mapping: json(inspection.suggestedMapping)
        },
        update: {
          sheetName: inspection.sheetName,
          headerRow: inspection.headerRow,
          headers: json(inspection.columns),
          mapping: json(inspection.suggestedMapping),
          lastUsedAt: new Date()
        }
      });
    }, { maxWait: 15_000, timeout: 180_000 });
    console.log(JSON.stringify({
      rolledBackBatch: batch.id,
      removedCandidates: candidateCount,
      structureKey: inspection.structureKey,
      automaticMapping: inspection.suggestedMapping
    }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});