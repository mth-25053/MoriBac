import { createHash } from "node:crypto";
import type ExcelJS from "exceljs";
import { AliasMatcher } from "@/lib/excel/alias-matcher";
import { cellText } from "@/lib/excel/cell-value";
import { normalizeHeader } from "@/lib/excel/header-normalizer";
import { requiredFields, type DetectedColumn, type WorkbookInspection } from "@/lib/excel/types";

type HeaderCandidate = {
  score: number;
  sheetIndex: number;
  sheetName: string;
  rowNumber: number;
  columns: DetectedColumn[];
  matched: ReturnType<AliasMatcher["match"]>;
};

export class HeaderDetector {
  constructor(private readonly matcher = new AliasMatcher()) {}

  detect(workbook: ExcelJS.Workbook): WorkbookInspection {
    let best: HeaderCandidate | null = null;

    for (const [sheetIndex, sheet] of workbook.worksheets.entries()) {
      const limit = Math.min(Math.max(sheet.actualRowCount, sheet.rowCount), 50);
      for (let rowNumber = 1; rowNumber <= limit; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const columns: DetectedColumn[] = [];
        let textCells = 0;
        let nonTextCells = 0;
        row.eachCell({ includeEmpty: false }, (cell, index) => {
          const header = cellText(cell).trim();
          if (!header) return;
          columns.push({ index, header, normalized: normalizeHeader(header) });
          if (typeof cell.value === "string" || (typeof cell.value === "object" && cell.value !== null && "text" in cell.value)) textCells += 1;
          else nonTextCells += 1;
        });
        if (columns.length < 2) continue;
        const matched = this.matcher.match(columns);
        const requiredMatches = requiredFields.filter((field) => matched.mapping[field]).length;
        const mappedCount = Object.keys(matched.mapping).length;
        const nextRowHasData = rowNumber < sheet.rowCount && sheet.getRow(rowNumber + 1).hasValues;
        const score = requiredMatches * 150 + mappedCount * 35 + columns.length * 5 + textCells * 3 + (nextRowHasData ? 10 : 0) - nonTextCells * 12 - rowNumber / 100;
        if (!best || score > best.score) best = { score, sheetIndex, sheetName: sheet.name, rowNumber, columns, matched };
      }
    }

    if (!best) throw new Error("EMPTY_FILE");
    const selected: HeaderCandidate = best;
    const structureKey = createHash("sha256").update(JSON.stringify(selected.columns.map((column) => [column.index, column.normalized]))).digest("hex");
    return {
      sheetIndex: selected.sheetIndex,
      sheetName: selected.sheetName,
      headerRow: selected.rowNumber,
      columns: selected.columns,
      structureKey,
      suggestedMapping: selected.matched.mapping,
      confidence: selected.matched.confidence,
      unresolvedRequired: requiredFields.filter((field) => !selected.matched.mapping[field])
    };
  }
}