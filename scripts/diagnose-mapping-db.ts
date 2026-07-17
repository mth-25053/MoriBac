import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) loadEnvFile(".env");
const mode = process.argv[2] === "direct" ? "direct" : "runtime";
if (mode === "direct" && process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

function details(error: unknown) {
  if (!(error instanceof Error)) return { value: String(error) };
  const record = error as Error & { code?: string; meta?: unknown; clientVersion?: string };
  return { name: error.name, message: error.message, code: record.code ?? "UNKNOWN", meta: record.meta, clientVersion: record.clientVersion, stack: error.stack };
}

async function main() {
  const queries: Array<{ query: string; duration: number }> = [];
  const db = new PrismaClient({ log: [{ emit: "event", level: "query" }, { emit: "event", level: "error" }] });
  db.$on("query", (event) => queries.push({ query: event.query, duration: event.duration }));
  const structureKey = `diagnostic-${randomUUID()}`;
  try {
    const table = await db.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ExcelMapping') AS "exists"`;
    if (!table[0]?.exists) throw new Error("ExcelMapping table does not exist");
    await db.$transaction(async (tx) => {
      await tx.excelMapping.create({ data: { structureKey, sheetName: "diagnostic", headerRow: 1, headers: [], mapping: {} } });
      const read = await tx.excelMapping.findUnique({ where: { structureKey } });
      if (!read) throw new Error("Diagnostic mapping could not be read back");
      await tx.excelMapping.delete({ where: { structureKey } });
    }, { maxWait: 5_000, timeout: 15_000 });
    console.log(JSON.stringify({ mode, tableExists: true, transaction: "insert-read-delete-ok", queries: queries.map((query) => ({ sql: query.query.replace(/\s+/g, " ").trim(), durationMs: query.duration })) }));
  } catch (error) {
    console.error(JSON.stringify({ mode, error: details(error), queries }, null, 2));
    process.exitCode = 1;
  } finally {
    await db.excelMapping.deleteMany({ where: { structureKey } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();