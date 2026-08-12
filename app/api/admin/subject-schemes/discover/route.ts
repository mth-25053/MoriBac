import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { DEFAULT_JSON_FIELD_MAPPING } from "@/lib/grades/default-mapping";
import { normalizeJsonRows } from "@/lib/grades/json-adapter";
import { detectSourceType, validateGradeFile } from "@/lib/grades/source-file";
import { buildDiscoveryReport } from "@/lib/grades/subject-discovery-service";
import { authorizeMutation, apiError } from "@/lib/http";
import { importWorkbookInput } from "@/lib/import-request";
import { yearSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXAM_TYPE = "bac";

function parseJsonArray(buffer: Buffer) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON_FILE");
  }
  if (!Array.isArray(parsed)) throw new Error("INVALID_JSON_FILE");
  return parsed;
}

/**
 * Fully read-only: resolves the exam year with findUnique (never upsert), and
 * buildDiscoveryReport only ever calls SubjectSchemeRepository.list(). No
 * SubjectScheme row - and no ExamYear row either - is ever created here.
 */
export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;

  try {
    const form = await request.formData();
    const parsedYear = yearSchema.safeParse({ year: form.get("year") });
    if (!parsedYear.success) return apiError("FILE_AND_YEAR_REQUIRED", 400);

    const input = await importWorkbookInput(form, auth.session.adminId);
    validateGradeFile(input.buffer, input.fileName);
    const sourceType = detectSourceType(input.fileName);
    if (sourceType !== "JSON") return apiError("SOURCE_TYPE_NOT_IMPLEMENTED", 422);

    const rawRows = parseJsonArray(input.buffer);
    const { rows, malformed } = normalizeJsonRows(rawRows, DEFAULT_JSON_FIELD_MAPPING);

    const examYear = await db.examYear.findUnique({ where: { year_session: { year: parsedYear.data.year, session: "NORMAL" } }, select: { id: true } });
    const report = await buildDiscoveryReport(examYear?.id ?? null, EXAM_TYPE, rows);

    return NextResponse.json({ ...report, malformedRowCount: malformed.length });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "subject-scheme-discover");
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INVALID_GRADE_FILE";
    return apiError(code, 422);
  }
}
