import { describe, expect, it } from "vitest";
import type { CandidateLookup, SubjectSchemeLookup } from "@/lib/grades/validate";
import { validateGradeRows } from "@/lib/grades/validate";
import type { NormalizedGradeRow } from "@/lib/grades/types";

const SN_CODES = ["AN", "AR", "EP", "FR", "IR", "MT", "PC", "SN"];
const LO_CODES = ["AR", "CH", "DM", "EP", "FR", "HG", "MT", "PI"];

const schemeRows = [
  ...SN_CODES.map((subjectCode) => ({ series: "SN", subjectCode })),
  ...LO_CODES.map((subjectCode) => ({ series: "LO", subjectCode }))
];

const candidates: Record<string, { id: string; series: string }> = {
  "00215": { id: "cand-215", series: "SN" },
  "00430": { id: "cand-430", series: "LO" }
};

function fakeCandidates(): CandidateLookup {
  return {
    async find({ candidateNumber }) {
      return candidates[candidateNumber] ?? null;
    }
  };
}

function fakeSchemes(): SubjectSchemeLookup {
  return {
    async listByYear() {
      return schemeRows;
    }
  };
}

function row(overrides: Partial<NormalizedGradeRow> = {}): NormalizedGradeRow {
  return { examYear: 2026, examType: "bac", candidateNumber: "00215", series: "SN", subjectCode: "MT", mark: 12, status: "GRADED", ...overrides };
}

function exemptRow(overrides: Partial<NormalizedGradeRow> = {}): NormalizedGradeRow {
  return row({ mark: null, status: "EXEMPT", ...overrides });
}

function fullSnRows(candidateNumber = "00215") {
  return SN_CODES.map((subjectCode) => row({ candidateNumber, subjectCode, mark: 10 }));
}

describe("validateGradeRows", () => {
  it("accepts a candidate with a complete, valid subject set as importable, with no set anomalies", async () => {
    const report = await validateGradeRows(fullSnRows(), { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.importable).toHaveLength(SN_CODES.length);
    expect(report.importable.every((entry) => entry.candidateId === "cand-215")).toBe(true);
    expect(report.incompleteSubjectSets).toEqual([]);
    expect(report.unexpectedSubjectSets).toEqual([]);
    expect(report.unmatched).toEqual([]);
    expect(report.seriesMismatch).toEqual([]);
    expect(report.unknownSubjectCodes).toEqual([]);
    expect(report.malformedMarks).toEqual([]);
    expect(report.duplicateInputRows).toEqual([]);
  });

  it("preserves the exact candidate number (including leading zeros) on importable rows", async () => {
    const report = await validateGradeRows([row({ candidateNumber: "00215" })], { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.importable[0].candidateNumber).toBe("00215");
  });

  it("flags a candidate number with no matching candidate as unmatched", async () => {
    const report = await validateGradeRows([row({ candidateNumber: "99999" })], { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.unmatched).toHaveLength(1);
    expect(report.unmatched[0].row.candidateNumber).toBe("99999");
    expect(report.importable).toEqual([]);
  });

  it("flags a row whose series does not match the matched candidate's series", async () => {
    const report = await validateGradeRows([row({ candidateNumber: "00215", series: "LO" })], { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.seriesMismatch).toHaveLength(1);
    expect(report.seriesMismatch[0].candidateSeries).toBe("SN");
    expect(report.importable).toEqual([]);
  });

  it("rejects every row sharing a candidate+subject key when duplicates exist, importing none of them", async () => {
    const rows = [row({ mark: 10 }), row({ mark: 15 })];
    const report = await validateGradeRows(rows, { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.duplicateInputRows).toHaveLength(2);
    expect(report.duplicateInputRows.map((entry) => entry.row.mark).sort()).toEqual([10, 15]);
    expect(report.importable).toEqual([]);
  });

  it("does not flag rows for a different subject or candidate as duplicates of an unrelated pair", async () => {
    const rows = [row({ mark: 10 }), row({ mark: 15 }), row({ subjectCode: "AR", mark: 8 })];
    const report = await validateGradeRows(rows, { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.duplicateInputRows).toHaveLength(2);
    expect(report.importable).toHaveLength(1);
    expect(report.importable[0].subjectCode).toBe("AR");
  });

  it("flags a subject code that does not exist for this exam year/type in any series as unknown", async () => {
    const report = await validateGradeRows([row({ subjectCode: "ZZ" })], { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.unknownSubjectCodes).toHaveLength(1);
    expect(report.unknownSubjectCodes[0].row.subjectCode).toBe("ZZ");
    expect(report.importable).toEqual([]);
  });

  it("flags a subject code that exists for a different series as an unexpected subject for this candidate", async () => {
    // PI is a real LO subject code, but the candidate here is series SN.
    const report = await validateGradeRows([row({ candidateNumber: "00215", series: "SN", subjectCode: "PI" })], {
      candidates: fakeCandidates(),
      schemes: fakeSchemes()
    });
    expect(report.unknownSubjectCodes).toEqual([]);
    expect(report.unexpectedSubjectSets).toHaveLength(1);
    expect(report.unexpectedSubjectSets[0]).toMatchObject({ candidateNumber: "00215", series: "SN", unexpectedSubjectCodes: ["PI"] });
    expect(report.importable).toEqual([]);
  });

  it("flags a mark below 0 or above 20 as a malformed mark", async () => {
    const report = await validateGradeRows([row({ mark: -1 }), row({ subjectCode: "AR", mark: 25 })], {
      candidates: fakeCandidates(),
      schemes: fakeSchemes()
    });
    expect(report.malformedMarks).toHaveLength(2);
    expect(report.malformedMarks.every((entry) => entry.reason === "MARK_OUT_OF_RANGE")).toBe(true);
    expect(report.importable).toEqual([]);
  });

  it("flags a candidate whose provided subject set is missing codes required by their series", async () => {
    const partialRows = fullSnRows().slice(0, 6); // 6 of 8 required SN codes
    const report = await validateGradeRows(partialRows, { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.incompleteSubjectSets).toHaveLength(1);
    expect(report.incompleteSubjectSets[0].candidateNumber).toBe("00215");
    expect(report.incompleteSubjectSets[0].missingSubjectCodes.sort()).toEqual(SN_CODES.slice(6).sort());
    expect(report.importable).toHaveLength(6);
  });

  it("handles two different candidates in the same batch independently", async () => {
    const rows = [...fullSnRows("00215"), ...LO_CODES.map((subjectCode) => row({ candidateNumber: "00430", series: "LO", subjectCode, mark: 8 }))];
    const report = await validateGradeRows(rows, { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.importable).toHaveLength(SN_CODES.length + LO_CODES.length);
    expect(report.incompleteSubjectSets).toEqual([]);
  });

  it("accepts an EXEMPT row (null mark) as importable, never as a malformed mark", async () => {
    const report = await validateGradeRows([exemptRow({ subjectCode: "EP" })], { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.malformedMarks).toEqual([]);
    expect(report.importable).toHaveLength(1);
    expect(report.importable[0]).toMatchObject({ status: "EXEMPT", mark: null, subjectCode: "EP" });
  });

  it("counts an EXEMPT row toward a candidate's complete subject set - it is not treated as missing", async () => {
    const rows = SN_CODES.map((subjectCode) => (subjectCode === "EP" ? exemptRow({ subjectCode }) : row({ subjectCode, mark: 10 })));
    const report = await validateGradeRows(rows, { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.incompleteSubjectSets).toEqual([]);
    expect(report.importable).toHaveLength(SN_CODES.length);
    const ep = report.importable.find((entry) => entry.subjectCode === "EP")!;
    expect(ep).toMatchObject({ status: "EXEMPT", mark: null });
  });

  it("still rejects a genuinely invalid non-null mark as malformed, distinct from an EXEMPT null mark", async () => {
    const report = await validateGradeRows([row({ mark: -1 }), exemptRow({ subjectCode: "AR" })], { candidates: fakeCandidates(), schemes: fakeSchemes() });
    expect(report.malformedMarks).toHaveLength(1);
    expect(report.malformedMarks[0].row.mark).toBe(-1);
    expect(report.importable).toHaveLength(1);
    expect(report.importable[0].subjectCode).toBe("AR");
  });
});
