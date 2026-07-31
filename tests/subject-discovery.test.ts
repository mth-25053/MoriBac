import { describe, expect, it } from "vitest";
import { discoverSubjectSchemes } from "@/lib/grades/subject-discovery";
import type { NormalizedGradeRow } from "@/lib/grades/types";

function row(overrides: Partial<NormalizedGradeRow> = {}): NormalizedGradeRow {
  return { examYear: 2026, examType: "bac", candidateNumber: "00001", series: "SN", subjectCode: "MT", mark: 12, status: "GRADED", ...overrides };
}

describe("discoverSubjectSchemes", () => {
  it("returns an empty report for zero rows", () => {
    const report = discoverSubjectSchemes([]);
    expect(report).toMatchObject({ examYear: null, examType: null, totalRows: 0, distinctSeries: [], proposedSchemes: [] });
  });

  it("identifies a subject that appears in only one series as unique", () => {
    const rows = [
      row({ series: "SN", subjectCode: "SN", candidateNumber: "1" }),
      row({ series: "SN", subjectCode: "MT", candidateNumber: "1" })
    ];
    const report = discoverSubjectSchemes(rows);
    expect(report.uniqueSubjects).toEqual([
      { subjectCode: "MT", series: "SN" },
      { subjectCode: "SN", series: "SN" }
    ]);
    expect(report.sharedSubjects).toEqual([]);
  });

  it("identifies a subject that appears across multiple series as shared", () => {
    const rows = [
      row({ series: "SN", subjectCode: "MT", candidateNumber: "1" }),
      row({ series: "LO", subjectCode: "MT", candidateNumber: "2" }),
      row({ series: "LM", subjectCode: "MT", candidateNumber: "3" })
    ];
    const report = discoverSubjectSchemes(rows);
    expect(report.sharedSubjects).toEqual([{ subjectCode: "MT", series: ["LM", "LO", "SN"] }]);
    expect(report.uniqueSubjects).toEqual([]);
  });

  it("produces one proposed scheme per series for a shared subject code, not a single merged entry", () => {
    const rows = [
      row({ series: "SN", subjectCode: "MT", candidateNumber: "1" }),
      row({ series: "LO", subjectCode: "MT", candidateNumber: "2" })
    ];
    const report = discoverSubjectSchemes(rows);
    const mtSchemes = report.proposedSchemes.filter((s) => s.subjectCode === "MT");
    expect(mtSchemes).toHaveLength(2);
    expect(mtSchemes.map((s) => s.series).sort()).toEqual(["LO", "SN"]);
  });

  it("detects inconsistent code spellings (case/whitespace/accent variants of the same underlying code)", () => {
    const rows = [
      row({ series: "SN", subjectCode: "MT", candidateNumber: "1" }),
      row({ series: "SN", subjectCode: "mt", candidateNumber: "2" }),
      row({ series: "SN", subjectCode: " MT ", candidateNumber: "3" })
    ];
    const report = discoverSubjectSchemes(rows);
    expect(report.codeVariantGroups).toHaveLength(1);
    expect(report.codeVariantGroups[0].variants.map((v) => v.raw).sort()).toEqual([" MT ", "MT", "mt"]);
  });

  it("does not flag a code as a variant group when only one spelling exists", () => {
    const rows = [row({ subjectCode: "MT", candidateNumber: "1" }), row({ subjectCode: "MT", candidateNumber: "2" })];
    const report = discoverSubjectSchemes(rows);
    expect(report.codeVariantGroups).toEqual([]);
  });

  it("counts distinct candidates separately from row count, so a duplicated row for the same candidate+subject does not inflate candidateCount", () => {
    const rows = [
      row({ series: "SN", subjectCode: "MT", candidateNumber: "1" }),
      row({ series: "SN", subjectCode: "MT", candidateNumber: "1" }), // duplicate row, same candidate+subject
      row({ series: "SN", subjectCode: "MT", candidateNumber: "2" })
    ];
    const report = discoverSubjectSchemes(rows);
    const mt = report.proposedSchemes.find((s) => s.subjectCode === "MT")!;
    expect(mt.rowCount).toBe(3);
    expect(mt.candidateCount).toBe(2);
  });

  it("always proposes a null coefficient marked as requiring confirmation, and null names, never guessing", () => {
    const rows = [row({ series: "SN", subjectCode: "MT" })];
    const report = discoverSubjectSchemes(rows);
    expect(report.proposedSchemes[0]).toMatchObject({ coefficient: null, coefficientRequiresConfirmation: true, nameAr: null, nameFr: null });
  });

  it("reports every distinct series found", () => {
    const rows = [row({ series: "SN" }), row({ series: "LO" }), row({ series: "SN" })];
    const report = discoverSubjectSchemes(rows);
    expect(report.distinctSeries).toEqual(["LO", "SN"]);
  });

  it("counts an EXEMPT row (null mark) the same as any other row for candidate/row totals", () => {
    const rows = [
      row({ subjectCode: "EP", candidateNumber: "1", mark: null, status: "EXEMPT" }),
      row({ subjectCode: "EP", candidateNumber: "2", mark: 15, status: "GRADED" })
    ];
    const report = discoverSubjectSchemes(rows);
    const ep = report.proposedSchemes.find((s) => s.subjectCode === "EP")!;
    expect(ep.candidateCount).toBe(2);
    expect(ep.rowCount).toBe(2);
  });

  it("carries examYear and examType from the rows into the report", () => {
    const rows = [row({ examYear: 2027, examType: "bac" })];
    const report = discoverSubjectSchemes(rows);
    expect(report.examYear).toBe(2027);
    expect(report.examType).toBe("bac");
  });
});
