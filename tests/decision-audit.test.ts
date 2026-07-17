import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseExcel } from "../lib/excel";

describe("official cancellation decision audit", () => {
  it("preserves official Arabic and French text while normalizing ANNULE", async () => {
    const decisions = ["إلغاء الامتحان", "امتحانه ملغى", "Examen annulé", "EXAMEN ANNULE"];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Results");
    sheet.addRow(["Candidate Number", "Full Name", "Series", "Average", "Decision"]);
    decisions.forEach((decision, index) => {
      sheet.addRow([`C-${index}`, `Candidate ${index}`, "SN", 0, decision]);
    });

    const report = await parseExcel(Buffer.from(await workbook.xlsx.writeBuffer()));

    expect(report.invalidRows).toBe(0);
    expect(report.rows.map((row) => row.decision)).toEqual(decisions.map(() => "ANNULE"));
    expect(report.rows.map((row) => row.officialDecision)).toEqual(decisions);
  });
});
