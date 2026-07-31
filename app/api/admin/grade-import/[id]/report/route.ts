import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { DEFAULT_JSON_FIELD_MAPPING } from "@/lib/grades/default-mapping";
import { normalizeJsonRows } from "@/lib/grades/json-adapter";
import { PrismaCandidateLookup, PrismaSubjectSchemeLookup } from "@/lib/grades/lookups";
import type { FlaggedRow, MalformedMarkRow, SeriesMismatchRow, ValidationReport } from "@/lib/grades/validate";
import { validateGradeRows } from "@/lib/grades/validate";
import { authorizeMutation, apiError } from "@/lib/http";
import { loadImportUpload } from "@/lib/import-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

type ReportLike = {
  unmatched: FlaggedRow[];
  seriesMismatch: SeriesMismatchRow[];
  duplicateInputRows: FlaggedRow[];
  unknownSubjectCodes: FlaggedRow[];
  malformedMarks: MalformedMarkRow[];
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function reportRows(report: ReportLike) {
  const rows: { category: string; candidateNumber: string; series: string; subjectCode: string; mark: number | null; detail: string }[] = [];
  for (const entry of report.unmatched) rows.push({ category: "UNMATCHED", candidateNumber: entry.row.candidateNumber, series: entry.row.series, subjectCode: entry.row.subjectCode, mark: entry.row.mark, detail: "" });
  for (const entry of report.seriesMismatch) rows.push({ category: "SERIES_MISMATCH", candidateNumber: entry.row.candidateNumber, series: entry.row.series, subjectCode: entry.row.subjectCode, mark: entry.row.mark, detail: `candidateSeries=${entry.candidateSeries}` });
  for (const entry of report.duplicateInputRows) rows.push({ category: "DUPLICATE_INPUT_ROW", candidateNumber: entry.row.candidateNumber, series: entry.row.series, subjectCode: entry.row.subjectCode, mark: entry.row.mark, detail: "" });
  for (const entry of report.unknownSubjectCodes) rows.push({ category: "UNKNOWN_SUBJECT_CODE", candidateNumber: entry.row.candidateNumber, series: entry.row.series, subjectCode: entry.row.subjectCode, mark: entry.row.mark, detail: "" });
  for (const entry of report.malformedMarks) rows.push({ category: "MALFORMED_MARK", candidateNumber: entry.row.candidateNumber, series: entry.row.series, subjectCode: entry.row.subjectCode, mark: entry.row.mark, detail: entry.reason });
  return rows;
}

/**
 * Downloads the dry-run validation report. If the original upload is still
 * retained (true until a successful commit cleans it up), the full report is
 * recomputed fresh and returned in full. Otherwise only the size-bounded
 * report stored at dry-run time is available - the response says so via
 * `truncated`, never silently.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  try {
    const batch = await db.gradeImportBatch.findUnique({ where: { id }, include: { examYear: { select: { year: true } } } });
    if (!batch) return apiError("BATCH_NOT_FOUND", 404);

    let report: ValidationReport | null = null;
    if (batch.uploadId) {
      try {
        const stored = await loadImportUpload(batch.adminId, batch.uploadId);
        const parsedJson: unknown = JSON.parse(stored.buffer.toString("utf8"));
        if (Array.isArray(parsedJson)) {
          const { rows } = normalizeJsonRows(parsedJson, DEFAULT_JSON_FIELD_MAPPING);
          const candidateLookup = new PrismaCandidateLookup();
          const schemeLookup = new PrismaSubjectSchemeLookup();
          await candidateLookup.preload(batch.examYear.year, batch.examType, rows.map((row) => row.candidateNumber));
          report = await validateGradeRows(rows, { candidates: candidateLookup, schemes: schemeLookup });
        }
      } catch {
        report = null; // fall through to the stored, capped report below
      }
    }

    const fallback = batch.dryRunReport as unknown as ReportLike | null;
    const reportLike: ReportLike | null = report ?? fallback;
    const truncated = report === null;

    if (format === "json") {
      const body = report
        ? { truncated: false, ...report }
        : { truncated: true, ...(fallback ?? {}) };
      return NextResponse.json(body, { headers: { "Content-Disposition": `attachment; filename="grade-import-${id}-report.json"` } });
    }

    const rows = reportLike ? reportRows(reportLike) : [];
    const header = `# truncated=${truncated}\ncategory,candidateNumber,series,subjectCode,mark,detail`;
    const csv = [header, ...rows.map((row) => [row.category, row.candidateNumber, row.series, row.subjectCode, row.mark, row.detail].map(csvEscape).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="grade-import-${id}-report.csv"` } });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "grade-import-report");
    return apiError("REPORT_UNAVAILABLE", 500);
  }
}
