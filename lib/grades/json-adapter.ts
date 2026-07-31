import type { GradeFieldMapping, MalformedRow, NormalizationResult } from "@/lib/grades/types";

const MIN_EXAM_YEAR = 2000;
const MAX_EXAM_YEAR = 2100;

function malformed(rowIndex: number, reason: string, rawData: unknown): MalformedRow {
  return { rowIndex, reason, rawData };
}

/**
 * Trims a string field, or stringifies a finite number as given - used for every
 * identity field except mark/examYear. Never re-pads a numeric candidate number:
 * if a source stores candidateNumber as a bare JSON number, any leading zeros are
 * already lost before this library sees it, and guessing a width back would risk
 * fabricating a number that doesn't match MoriBac's stored value. That case is
 * left to surface downstream as an "unmatched candidate", not silently patched here.
 */
function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asExamYear(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(num) || num < MIN_EXAM_YEAR || num > MAX_EXAM_YEAR) return null;
  return num;
}

type MarkClassification = { status: "GRADED"; mark: number } | { status: "EXEMPT"; mark: null } | { status: "INVALID" };

/**
 * A literal JSON null is a deliberate academic status (exemption from this
 * subject, e.g. EP/Physical Education), not a malformed value - it is only
 * ever reached once every identity field (candidate, series, subjectCode,
 * examYear, examType) has already been confirmed valid by the caller, so an
 * EXEMPT row is always a real, addressable row. Anything else that isn't a
 * finite number (a string that doesn't parse, undefined, an object, ...) is
 * still a structural failure.
 */
function classifyMark(value: unknown): MarkClassification {
  if (value === null) return { status: "EXEMPT", mark: null };
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(num) ? { status: "GRADED", mark: num } : { status: "INVALID" };
}

/**
 * Normalizes an array of plain-object rows (already JSON.parse'd) into the shared
 * NormalizedGradeRow contract, using a caller-supplied field mapping so no source's
 * specific field names are ever hardcoded here. Mark-range and business-rule checks
 * (duplicate rows, unknown subject codes, candidate matching, ...) are deliberately
 * not done here - this function only decides whether a row can be structurally built
 * at all; everything else is lib/grades/validate.ts's job.
 */
export function normalizeJsonRows(rawRows: unknown[], mapping: GradeFieldMapping): NormalizationResult {
  const rows: NormalizationResult["rows"] = [];
  const malformedRows: MalformedRow[] = [];

  for (const [rowIndex, raw] of rawRows.entries()) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      malformedRows.push(malformed(rowIndex, "ROW_NOT_AN_OBJECT", raw));
      continue;
    }
    const record = raw as Record<string, unknown>;

    const examYear = asExamYear(record[mapping.examYearField]);
    if (examYear === null) { malformedRows.push(malformed(rowIndex, "INVALID_EXAM_YEAR", raw)); continue; }

    const examType = asTrimmedString(record[mapping.examTypeField]);
    if (examType === null) { malformedRows.push(malformed(rowIndex, "INVALID_EXAM_TYPE", raw)); continue; }

    const candidateNumber = asTrimmedString(record[mapping.candidateNumberField]);
    if (candidateNumber === null) { malformedRows.push(malformed(rowIndex, "INVALID_CANDIDATE_NUMBER", raw)); continue; }

    const series = asTrimmedString(record[mapping.seriesField]);
    if (series === null) { malformedRows.push(malformed(rowIndex, "INVALID_SERIES", raw)); continue; }

    const subjectCode = asTrimmedString(record[mapping.subjectCodeField]);
    if (subjectCode === null) { malformedRows.push(malformed(rowIndex, "INVALID_SUBJECT_CODE", raw)); continue; }

    const markResult = classifyMark(record[mapping.markField]);
    if (markResult.status === "INVALID") { malformedRows.push(malformed(rowIndex, "MARK_NOT_NUMERIC", raw)); continue; }

    rows.push({ examYear, examType, candidateNumber, series, subjectCode, mark: markResult.mark, status: markResult.status });
  }

  return { rows, malformed: malformedRows };
}
