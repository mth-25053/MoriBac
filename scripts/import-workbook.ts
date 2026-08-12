import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { CSRF_COOKIE, SESSION_COOKIE } from "../lib/constants";
import { inspectExcel, parseExcel } from "../lib/excel";

if (existsSync(".env")) loadEnvFile(".env");

const filePath = process.argv[2];
const year = Number(process.argv[3]);
const inputBase = process.argv[4] || "http://localhost:3000";
const base = inputBase.endsWith("/") ? inputBase.slice(0, -1) : inputBase;
const publishMode = process.argv[5] || ""; // "", "--publish", or "--publish-default"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function retry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function post(path: "preview" | "commit", buffer: Buffer, token: string, csrf: string, checksum?: string) {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const body = new FormData();
    body.set("year", String(year));
    body.set("file", new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), basename(filePath));
    if (checksum) body.set("checksum", checksum);
    const response = await fetch(base + "/api/admin/import/" + path, {
      method: "POST",
      headers: {
        origin: base,
        cookie: SESSION_COOKIE + "=" + token + "; " + CSRF_COOKIE + "=" + csrf,
        "x-csrf-token": csrf
      },
      body,
      signal: AbortSignal.timeout(300_000)
    });
    last = await response.text();
    if (response.ok) return JSON.parse(last) as Record<string, unknown>;
    if (response.status !== 503 || attempt === 3) throw new Error(path + " returned " + response.status + ": " + last);
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
  }
  throw new Error(last);
}

async function publishYear(yearId: string, action: "publish" | "default", token: string, csrf: string) {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(base + "/api/admin/years/" + yearId, {
      method: "PATCH",
      headers: {
        origin: base,
        cookie: SESSION_COOKIE + "=" + token + "; " + CSRF_COOKIE + "=" + csrf,
        "x-csrf-token": csrf,
        "content-type": "application/json"
      },
      body: JSON.stringify({ action }),
      signal: AbortSignal.timeout(30_000)
    });
    last = await response.text();
    if (response.ok) return JSON.parse(last) as Record<string, unknown>;
    if (response.status !== 503 || attempt === 3) throw new Error("publish returned " + response.status + ": " + last);
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
  }
  throw new Error(last);
}

async function main() {
  assert(filePath && Number.isInteger(year), "Usage: tsx scripts/import-workbook.ts <file.xlsx> <year> [base-url] [--publish|--publish-default]");
  const secret = process.env.AUTH_SECRET;
  assert(secret && secret.length >= 32, "AUTH_SECRET is not configured");
  const buffer = await readFile(filePath);
  const inspection = await inspectExcel(buffer);
  assert(inspection.unresolvedRequired.length === 0, "Automatic mapping unresolved: " + inspection.unresolvedRequired.join(", "));
  const local = await parseExcel(buffer);
  assert(local.invalidRows === 0, "Workbook has " + local.invalidRows + " invalid rows");

  const db = new PrismaClient();
  try {
    const admin = await retry(() => db.admin.findFirst({ orderBy: { createdAt: "asc" } }));
    assert(admin, "No administrator exists");
    const existing = await retry(() => db.examYear.findUnique({
      where: { year_session: { year, session: "NORMAL" } },
      select: { id: true, _count: { select: { candidates: true } }, imports: { where: { checksum: local.checksum }, select: { status: true } } }
    }));

    const token = await new SignJWT({ adminId: admin.id, email: admin.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .setJti(randomBytes(16).toString("hex"))
      .sign(new TextEncoder().encode(secret));
    const csrf = randomBytes(32).toString("hex");

    async function maybePublish(yearId: string) {
      if (publishMode !== "--publish" && publishMode !== "--publish-default") return null;
      return publishYear(yearId, publishMode === "--publish-default" ? "default" : "publish", token, csrf);
    }

    if (existing?._count.candidates) {
      const imported = existing.imports.some((batch) => batch.status === "IMPORTED");
      assert(imported && existing._count.candidates === local.validRows, "Year has a partial or conflicting import");
      const published = await maybePublish(existing.id);
      console.log(JSON.stringify({ alreadyImported: true, imported: existing._count.candidates, inspection, checksum: local.checksum, published: Boolean(published) }, null, 2));
      return;
    }

    const preview = await post("preview", buffer, token, csrf);
    assert(preview.mappingRequired === false, "API unexpectedly requested mapping");
    assert(preview.validRows === local.validRows && preview.invalidRows === 0, "API preview differs from local validation");
    const committed = await post("commit", buffer, token, csrf, String(preview.checksum));
    assert(committed.ok === true && committed.imported === local.validRows, "Commit count differs from preview");

    const importedYear = await retry(() => db.examYear.findUniqueOrThrow({ where: { year_session: { year, session: "NORMAL" } }, select: { id: true } }));
    const published = await maybePublish(importedYear.id);

    console.log(JSON.stringify({
      alreadyImported: false,
      inspection,
      mappingSource: preview.mappingSource,
      checksum: preview.checksum,
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      invalidRows: preview.invalidRows,
      batchId: committed.batchId,
      imported: committed.imported,
      published: Boolean(published)
    }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});