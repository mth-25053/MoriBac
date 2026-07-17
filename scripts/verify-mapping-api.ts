import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { SignJWT } from "jose";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { inspectExcel, type ColumnMapping } from "@/lib/excel";

if (existsSync(".env")) loadEnvFile(".env");
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const temporaryYear = 2099;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function makeWorkbook(preamble: boolean, candidateNumber: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Future BAC");
  if (preamble) {
    sheet.addRow(["Future official results"]);
    sheet.addRow([]);
  }
  sheet.addRow(["Code X", "Identity X", "Branch X", "Grade X", "Outcome X", "Unused X"]);
  sheet.addRow([candidateNumber, "Future Candidate", "FUT", 12.5, "ADMIS", "ignored"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function postImportApi(path: "preview" | "commit", buffer: Buffer, token: string, csrf: string, mapping?: ColumnMapping, checksum?: string) {
  const body = new FormData();
  body.set("year", String(temporaryYear));
  body.set("file", new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "BAC-future.xlsx");
  if (mapping) body.set("mapping", JSON.stringify(mapping));
  if (checksum) body.set("checksum", checksum);
  let lastBody = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${base}/api/admin/import/${path}`, {
      method: "POST",
      headers: {
        origin: base,
        cookie: `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=${csrf}`,
        "x-csrf-token": csrf
      },
      body
    });
    lastBody = await response.text();
    if (response.ok) return JSON.parse(lastBody) as Record<string, unknown>;
    if (response.status !== 503 || attempt === 3) throw new Error(`${path} returned ${response.status}: ${lastBody}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
  }
  throw new Error(lastBody);
}

async function main() {
  const secret = process.env.AUTH_SECRET;
  assert(secret && secret.length >= 32, "AUTH_SECRET is not configured");
  const db = new PrismaClient();
  let createdYear = false;
  let structureKey: string | undefined;
  try {
    const existingYear = await db.examYear.findUnique({ where: { year: temporaryYear } });
    assert(!existingYear, `Temporary verification year ${temporaryYear} already exists`);
    const admin = await db.admin.findFirst({ orderBy: { createdAt: "asc" } });
    assert(admin, "No administrator exists");
    const token = await new SignJWT({ adminId: admin.id, email: admin.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .setJti(randomBytes(16).toString("hex"))
      .sign(new TextEncoder().encode(secret));
    const csrf = randomBytes(32).toString("hex");
    const firstFile = await makeWorkbook(true, "99001");
    const localInspection = await inspectExcel(firstFile);
    structureKey = localInspection.structureKey;
    await db.excelMapping.deleteMany({ where: { structureKey } });
    const first = await postImportApi("preview", firstFile, token, csrf);
    assert(first.mappingRequired === true, "Unknown schema did not open the Mapping Wizard contract");
    assert(Array.isArray(first.columns) && first.columns.length === 6, "Detected columns were not returned");
    assert(first.headerRow === 3, "Header row was not detected after the preamble");
    structureKey = String(first.structureKey);

    const mapping: ColumnMapping = { candidateNumber: 1, fullName: 2, series: 3, average: 4, decision: 5 };
    const manual = await postImportApi("preview", firstFile, token, csrf, mapping);
    createdYear = true;
    assert(manual.mappingRequired === false && manual.mappingSource === "manual", "Manual mapping was not accepted");
    assert(manual.validRows === 1 && manual.invalidRows === 0, "Manual mapping preview failed validation");
    const manualPreview = (manual.preview as Array<Record<string, unknown>>)[0];
    assert(manualPreview.wilaya === null && manualPreview.school === null && manualPreview.candidateType === null, "Missing optional fields were not parsed as null");

    const committed = await postImportApi("commit", firstFile, token, csrf, mapping, String(manual.checksum));
    assert(committed.ok === true && committed.imported === 1, "Mapped workbook did not commit normally");
    const year = await db.examYear.findUnique({ where: { year: temporaryYear } });
    assert(year, "Temporary exam year was not created");
    const inserted = await db.candidate.findUnique({ where: { examYearId_candidateNumber: { examYearId: year.id, candidateNumber: "99001" } } });
    assert(inserted, "Mapped candidate was not stored");
    assert(inserted.wilaya === null && inserted.examCenter === null && inserted.school === null && inserted.candidateType === null, "Optional database columns were not NULL");

    const secondFile = await makeWorkbook(false, "99002");
    const reused = await postImportApi("preview", secondFile, token, csrf);
    assert(reused.mappingRequired === false && reused.mappingSource === "saved", "Saved structure mapping was not reused automatically");
    assert(reused.validRows === 1 && reused.headerRow === 1, "Saved mapping failed with a different header-row position");
    const saved = await db.excelMapping.findUnique({ where: { structureKey } });
    assert(saved, "Mapping was not persisted in the database");
    console.log("MAPPING_WIZARD_OK detected=6 headerRow=3");
    console.log("MANUAL_MAPPING_IMPORT_OK imported=1 optionalDatabaseNull=true");
    console.log("SAVED_MAPPING_REUSED_OK headerRow=1 valid=1");
  } finally {
    if (createdYear) await db.examYear.deleteMany({ where: { year: temporaryYear } });
    if (structureKey) await db.excelMapping.deleteMany({ where: { structureKey } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "MAPPING_API_VERIFICATION_FAILED");
  process.exitCode = 1;
});