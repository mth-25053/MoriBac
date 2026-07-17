import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { SignJWT } from "jose";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { inspectExcel } from "@/lib/excel";
import { withDatabaseRetry } from "@/lib/database-retry";

if (existsSync(".env")) loadEnvFile(".env");
const runtimeUrl = process.env.DATABASE_URL;
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
const base = "http://localhost:3000";
const yearNumber = 2098;

async function workbook(candidate: string) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("BAC 2024 reproduction");
  sheet.addRow(["BAC 2024"]);
  sheet.addRow([]);
  sheet.addRow(["Code 24", "Identity 24", "Branch 24", "Grade 24", "Outcome 24"]);
  sheet.addRow([candidate, "Candidate 2024", "SN", 11.25, "ADMIS"]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function request(buffer: Buffer, token: string, csrf: string, mapping?: Record<string, number>) {
  const form = new FormData();
  form.set("year", String(yearNumber));
  form.set("file", new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "BAC2024-reproduction.xlsx");
  if (mapping) form.set("mapping", JSON.stringify(mapping));
  const response = await fetch(`${base}/api/admin/import/preview`, { method: "POST", headers: { origin: base, cookie: `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=${csrf}`, "x-csrf-token": csrf }, body: form });
  return { status: response.status, body: await response.text() };
}

async function main() {
  const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  let structureKey = "";
  try {
    const admin = await withDatabaseRetry(() => db.admin.findFirst(), "reproducer-admin", { maxAttempts: 3, timeoutMs: 12_000 });
    if (!admin || !process.env.AUTH_SECRET) throw new Error("Admin or AUTH_SECRET missing");
    const token = await new SignJWT({ adminId: admin.id, email: admin.email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const csrf = randomBytes(32).toString("hex");
    const firstBuffer = await workbook("24000");
    structureKey = (await inspectExcel(firstBuffer)).structureKey;
    await db.excelMapping.deleteMany({ where: { structureKey } });
    const wizard = await request(firstBuffer, token, csrf);
    console.log(`WIZARD_REQUEST status=${wizard.status} body=${wizard.body}`);
    const mapping = { candidateNumber: 1, fullName: 2, series: 3, average: 4, decision: 5 };
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const result = await request(await workbook(`24${String(attempt).padStart(3, "0")}`), token, csrf, mapping);
      console.log(`CONFIRM_ATTEMPT=${attempt} status=${result.status} body=${result.body}`);
      if (result.status === 503) break;
    }
  } finally {
    await withDatabaseRetry(() => db.examYear.deleteMany({ where: { year: yearNumber } }), "reproducer-cleanup-year", { maxAttempts: 3, timeoutMs: 12_000 });
    if (structureKey) await withDatabaseRetry(() => db.excelMapping.deleteMany({ where: { structureKey } }), "reproducer-cleanup-mapping", { maxAttempts: 3, timeoutMs: 12_000 });
    await db.$disconnect();
    process.env.DATABASE_URL = runtimeUrl;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });