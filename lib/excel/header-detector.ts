import { createHash } from "node:crypto";
import type ExcelJS from "exceljs";
import { AliasMatcher } from "@/lib/excel/alias-matcher";
import { cellText } from "@/lib/excel/cell-value";
import { normalizeHeader } from "@/lib/excel/header-normalizer";
import { requiredFields, type DetectedColumn, type WorkbookInspection } from "@/lib/excel/types";

/**
 * Detection tuning, named and documented in one place instead of scattered magic
 * numbers. Same defaults as before this was extracted - purely a readability/
 * configurability change, not a behavior change.
 */
export const HEADER_DETECTION_CONFIG = {
  maxRowsScannedPerSheet: 50,
  minColumnsForHeaderRow: 2,
  weights: {
    requiredFieldMatch: 150,
    mappedField: 35,
    columnPresent: 5,
    textCell: 3,
    nextRowHasData: 10,
    nonTextCellPenalty: 12,
    rowNumberPenaltyDivisor: 100
  }
};

type HeaderCandidate = {
  score: number;
  sheetIndex: number;
  sheetName: string;
  rowNumber: number;
  columns: DetectedColumn[];
  matched: ReturnType<AliasMatcher["match"]>;
};

export class HeaderDetector {
  constructor(
    private readonly matcher = new AliasMatcher(),
    private readonly config = HEADER_DETECTION_CONFIG
  ) {}

  detect(workbook: ExcelJS.Workbook): WorkbookInspection {
    if (workbook.worksheets.length === 0) throw new Error("NO_SHEETS_FOUND");

    let best: HeaderCandidate | null = null;
    const { weights } = this.config;

    for (const [sheetIndex, sheet] of workbook.worksheets.entries()) {
      const limit = Math.min(Math.max(sheet.actualRowCount, sheet.rowCount), this.config.maxRowsScannedPerSheet);
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
        if (columns.length < this.config.minColumnsForHeaderRow) continue;
        const matched = this.matcher.match(columns);
        const requiredMatches = requiredFields.filter((field) => matched.mapping[field]).length;
        const mappedCount = Object.keys(matched.mapping).length;
        const nextRowHasData = rowNumber < sheet.rowCount && sheet.getRow(rowNumber + 1).hasValues;
        const score = requiredMatches * weights.requiredFieldMatch
          + mappedCount * weights.mappedField
          + columns.length * weights.columnPresent
          + textCells * weights.textCell
          + (nextRowHasData ? weights.nextRowHasData : 0)
          - nonTextCells * weights.nonTextCellPenalty
          - rowNumber / weights.rowNumberPenaltyDivisor;
        if (!best || score > best.score) best = { score, sheetIndex, sheetName: sheet.name, rowNumber, columns, matched };
      }
    }

    if (!best) throw new Error("NO_HEADER_ROW_DETECTED");
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
      unresolvedRequired: requiredFields.filter((field) => !selected.matched.mapping[field]),
      sheetsScanned: workbook.worksheets.length
    };
  }
}
