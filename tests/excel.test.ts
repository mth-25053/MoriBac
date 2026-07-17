import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import {
  MappingRequiredError,
  HeaderNormalizer,
  inspectExcel,
  parseExcel,
  validateExcelFile,
  type ColumnMapping
} from "@/lib/excel";
import { resolveMapping } from "@/lib/excel/mapping-service";
import { assertBatchCanBeValidated, DuplicateImportError } from "@/lib/import-batches";

async function workbook(rows: unknown[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Results");
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}

const headers = ["Candidate Number", "Full Name", "Series", "Average", "Decision", "Wilaya", "Exam Center", "School"];

describe("schema-independent Excel validation", () => {
  it("normalizes accents, whitespace, underscores, and punctuation", () => {
    expect(HeaderNormalizer.normalize("  Numéro_du candidat! ")).toBe("NUMERODUCANDIDAT");
    expect(HeaderNormalizer.normalize("Centre d’examen")).toBe("CENTREDEXAMEN");
  });

  it("detects a header row after preamble rows and accepts missing optional fields as null", async () => {
    const buffer = await workbook([
      ["Ministère de l’Éducation"],
      ["Résultats définitifs 2026"],
      [],
      ["N° candidat", "Nom et prénom", "Série", "Moyenne générale", "Décision"],
      ["00001", "Aïcha Mohamed", "SN", 14.25, "Admis"]
    ]);
    const inspection = await inspectExcel(buffer);
    expect(inspection.headerRow).toBe(4);
    expect(inspection.unresolvedRequired).toEqual([]);
    const report = await parseExcel(buffer);
    expect(report.validRows).toBe(1);
    expect(report.rows[0]).toMatchObject({ candidateNumber: "00001", fullName: "Aïcha Mohamed", average: 14.25 });
    expect(report.rows[0].wilaya).toBeNull();
    expect(report.rows[0].examCenter).toBeNull();
    expect(report.rows[0].school).toBeNull();
    expect(report.rows[0].birthDate).toBeNull();
    expect(report.rows[0].candidateType).toBeNull();
  });

  it("uses aliases and fuzzy matching for reordered, misspelled English headers", async () => {
    const buffer = await workbook([
      ["Verdict", "Candidate Nmae", "Averge", "Candidate Identifier", "Stram", "Origin School"],
      ["PASSED", "Mariam Diallo", "12,75", "A-009", "LM", "School West"]
    ]);
    const inspection = await inspectExcel(buffer);
    expect(inspection.unresolvedRequired).toEqual([]);
    const report = await parseExcel(buffer);
    expect(report.rows[0]).toMatchObject({
      candidateNumber: "A-009",
      fullName: "Mariam Diallo",
      series: "LM",
      average: 12.75,
      decision: "ADMIS",
      school: "School West"
    });
  });

  it("matches language-suffixed headers and localized decisions with harmless suffixes", async () => {
    const buffer = await workbook([
      ["Num_Bac", "Nom_FR", "SERIE", "Moy_Bac", "Decision", "Wilaya_FR", "Centre Examen FR", "Etablissement_FR", "Lieun_FR"],
      ["00001", "Aicha Mohamed", "SN", 10.5, "Admis Sn", "Trarza", "Centre A", "Lycee A", "Rosso"],
      ["00002", "Mariam Diallo", "LM", 6.25, "Ajourné Sn", "Gorgol", "Centre B", "Lycee B", "Kaedi"],
      ["00003", "Ahmed Salem", "M", 0, "Abscent", "Adrar", "Centre C", "Lycee C", "Atar"]
    ]);
    const inspection = await inspectExcel(buffer);
    expect(inspection.unresolvedRequired).toEqual([]);
    expect(inspection.suggestedMapping).toMatchObject({ fullName: 2, birthPlace: 9 });
    const report = await parseExcel(buffer);
    expect(report.invalidRows).toBe(0);
    expect(report.rows.map((row) => row.decision)).toEqual(["ADMIS", "REDOUBLE", "ABSENT"]);
  });
  it("requests mapping instead of rejecting unknown required columns, then imports with manual mapping", async () => {
    const buffer = await workbook([
      ["Code X", "Identity X", "Branch X", "Grade X", "Outcome X", "Extra X"],
      ["007", "Fatimetou", "M", 11.5, "ADMIS", "ignored"]
    ]);
    const inspection = await inspectExcel(buffer);
    expect(inspection.unresolvedRequired.length).toBeGreaterThan(0);
    await expect(parseExcel(buffer)).rejects.toBeInstanceOf(MappingRequiredError);
    const mapping: ColumnMapping = { candidateNumber: 1, fullName: 2, series: 3, average: 4, decision: 5 };
    const report = await parseExcel(buffer, mapping, inspection);
    expect(report.validRows).toBe(1);
    expect(report.rows[0].candidateNumber).toBe("007");
  });

  it("produces the same structure key when only the header row position changes", async () => {
    const first = await inspectExcel(await workbook([headers, ["001", "A", "SN", 10, "ADMIS", "W", "C", "S"]]));
    const second = await inspectExcel(await workbook([["Official results"], [], headers, ["002", "B", "SN", 11, "ADMIS", "W", "C", "S"]]));
    expect(second.headerRow).toBe(3);
    expect(second.structureKey).toBe(first.structureKey);
  });

  it("reuses a saved mapping before automatic aliases", async () => {
    const inspection = await inspectExcel(await workbook([["Code X", "Identity X", "Branch X", "Grade X", "Outcome X"], ["1", "A", "M", 10, "ADMIS"]]));
    const saved: ColumnMapping = { candidateNumber: 1, fullName: 2, series: 3, average: 4, decision: 5 };
    const repository = { find: vi.fn().mockResolvedValue(saved) };
    const resolved = await resolveMapping(inspection, null, repository);
    expect(resolved.source).toBe("saved");
    expect(resolved.mapping).toEqual(saved);
    expect(resolved.missing).toEqual([]);
  });

  it("preserves formatted leading zeros and normalizes decisions", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Results");
    sheet.addRow(headers);
    const row = sheet.addRow([1, "Ahmed", "C", 13.47, "ADMIS", "Nouakchott", "Centre A", "Lycée A"]);
    row.getCell(1).numFmt = "00000";
    const report = await parseExcel(Buffer.from(await book.xlsx.writeBuffer()));
    expect(report.invalidRows).toBe(0);
    expect(report.rows[0].candidateNumber).toBe("00001");
    expect(report.rows[0].average).toBe(13.47);
  });

  it("reports duplicate candidate numbers and invalid averages", async () => {
    const buffer = await workbook([headers, ["001", "A", "C", 21, "ADMIS", "W", "X", "S"], ["001", "B", "C", 10, "REDOUBLE", "W", "X", "S"]]);
    const report = await parseExcel(buffer);
    expect(report.invalidRows).toBe(2);
    expect(report.errors.some((error) => error.message.includes("Duplicate"))).toBe(true);
    expect(report.errors.some((error) => error.field === "average")).toBe(true);
  });

  it("rejects a non-XLSX signature", () => {
    expect(() => validateExcelFile(Buffer.from("not a workbook"), "results.xlsx", "application/octet-stream")).toThrow("INVALID_XLSX_SIGNATURE");
  });

  it("prevents an already imported checksum from being validated again", () => {
    expect(() => assertBatchCanBeValidated({ status: "IMPORTED", examYearId: "year-1" }, "year-1")).toThrow(DuplicateImportError);
    expect(() => assertBatchCanBeValidated({ status: "VALIDATED", examYearId: "year-1" }, "year-1")).not.toThrow();
  });

  it("validates the real BAC2025 workbook and preserves all official fields", async () => {
    const buffer = await readFile("BAC2025.xlsx");
    validateExcelFile(buffer, "BAC2025.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const report = await parseExcel(buffer);
    expect(report.totalRows).toBe(53_148);
    expect(report.validRows).toBe(53_148);
    expect(report.invalidRows).toBe(0);
    expect(report.rows.filter((row) => row.decision === "ANNULE")).toHaveLength(335);
    expect(report.rows.find((row) => row.candidateNumber === "00002")).toMatchObject({
      candidateNumber: "00002",
      fullName: "[REDACTED CANDIDATE NAME]",
      series: "M",
      average: 8.47,
      decision: "SESSIONNAIRE",
      wilaya: "Trarza",
      examCenter: "Lycée Rosso",
      school: "Rosso Candidat Libre",
      candidateType: "CL"
    });
  }, 30_000);
});