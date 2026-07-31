import { describe, expect, it } from "vitest";
import { normalizeJsonRows } from "@/lib/grades/json-adapter";
import type { GradeFieldMapping } from "@/lib/grades/types";

const mapping: GradeFieldMapping = {
  examYearField: "examYear",
  examTypeField: "exam",
  candidateNumberField: "candidateNumber",
  seriesField: "series",
  subjectCodeField: "subjectCode",
  markField: "mark"
};

function row(overrides: Record<string, unknown> = {}) {
  return { examYear: 2026, exam: "bac", candidateNumber: "00215", series: "SN", subjectCode: "MT", mark: 12.5, ...overrides };
}

describe("normalizeJsonRows", () => {
  it("normalizes a valid row as GRADED", () => {
    const { rows, malformed } = normalizeJsonRows([row()], mapping);
    expect(malformed).toEqual([]);
    expect(rows).toEqual([{ examYear: 2026, examType: "bac", candidateNumber: "00215", series: "SN", subjectCode: "MT", mark: 12.5, status: "GRADED" }]);
  });

  it("accepts a literal null mark as a valid EXEMPT row, not malformed", () => {
    const { rows, malformed } = normalizeJsonRows([row({ mark: null })], mapping);
    expect(malformed).toEqual([]);
    expect(rows).toEqual([{ examYear: 2026, examType: "bac", candidateNumber: "00215", series: "SN", subjectCode: "MT", mark: null, status: "EXEMPT" }]);
  });

  it("still rejects a genuinely invalid (non-null) mark as malformed", () => {
    const { rows, malformed } = normalizeJsonRows([row({ mark: "abc" })], mapping);
    expect(rows).toEqual([]);
    expect(malformed[0].reason).toBe("MARK_NOT_NUMERIC");
  });

  it("preserves the candidate number exactly as given, including leading zeros", () => {
    const { rows } = normalizeJsonRows([row({ candidateNumber: "00215" })], mapping);
    expect(rows[0].candidateNumber).toBe("00215");
  });

  it("does not re-pad a bare numeric candidate number - it stringifies as given, lossily", () => {
    const { rows } = normalizeJsonRows([row({ candidateNumber: 215 })], mapping);
    expect(rows[0].candidateNumber).toBe("215");
  });

  it("rejects a row that is not an object", () => {
    const { rows, malformed } = normalizeJsonRows(["not-an-object", null, ["array"], 42], mapping);
    expect(rows).toEqual([]);
    expect(malformed).toHaveLength(4);
    expect(malformed.every((entry) => entry.reason === "ROW_NOT_AN_OBJECT")).toBe(true);
    expect(malformed.map((entry) => entry.rowIndex)).toEqual([0, 1, 2, 3]);
  });

  it("rejects a row with a missing or invalid exam year", () => {
    const { rows, malformed } = normalizeJsonRows([row({ examYear: "not-a-year" }), row({ examYear: undefined })], mapping);
    expect(rows).toEqual([]);
    expect(malformed.map((entry) => entry.reason)).toEqual(["INVALID_EXAM_YEAR", "INVALID_EXAM_YEAR"]);
  });

  it("rejects a row with a missing candidate number", () => {
    const { rows, malformed } = normalizeJsonRows([row({ candidateNumber: "" })], mapping);
    expect(rows).toEqual([]);
    expect(malformed[0].reason).toBe("INVALID_CANDIDATE_NUMBER");
  });

  it("rejects a row with a non-numeric mark", () => {
    const { rows, malformed } = normalizeJsonRows([row({ mark: "not-a-number" })], mapping);
    expect(rows).toEqual([]);
    expect(malformed[0].reason).toBe("MARK_NOT_NUMERIC");
  });

  it("keeps the original row index and raw data on every malformed entry", () => {
    const bad = row({ mark: "not-a-number" });
    const { malformed } = normalizeJsonRows([row(), bad], mapping);
    expect(malformed).toHaveLength(1);
    expect(malformed[0].rowIndex).toBe(1);
    expect(malformed[0].rawData).toEqual(bad);
  });

  it("accepts a numeric mark given as a string", () => {
    const { rows, malformed } = normalizeJsonRows([row({ mark: "14.75" })], mapping);
    expect(malformed).toEqual([]);
    expect(rows[0].mark).toBe(14.75);
  });
});
