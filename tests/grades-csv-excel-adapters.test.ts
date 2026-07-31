import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { normalizeCsvRows } from "@/lib/grades/csv-adapter";
import { normalizeExcelRows } from "@/lib/grades/excel-adapter";
import type { GradeFieldMapping } from "@/lib/grades/types";

const mapping: GradeFieldMapping = {
  examYearField: "examYear",
  examTypeField: "exam",
  candidateNumberField: "candidateNumber",
  seriesField: "series",
  subjectCodeField: "subjectCode",
  markField: "mark"
};

describe("CSV and Excel grade adapters (interface contracts only)", () => {
  it("normalizeCsvRows exposes the shared contract but is not implemented yet", () => {
    expect(() => normalizeCsvRows({ headerRow: ["candidateNumber", "mark"], dataRows: [["00215", "12"]] }, mapping)).toThrow(
      /not implemented yet/
    );
  });

  it("normalizeExcelRows exposes the shared contract but is not implemented yet", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Grades");
    await expect(normalizeExcelRows(workbook, mapping)).rejects.toThrow(/not implemented yet/);
  });
});
