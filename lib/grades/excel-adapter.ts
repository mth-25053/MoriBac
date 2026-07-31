import type ExcelJS from "exceljs";
import type { GradeFieldMapping, NormalizationResult } from "@/lib/grades/types";

/**
 * Contract only. No real Excel subject-grade workbook exists yet to design the
 * parsing against - when one does, this should reuse lib/excel's header-detection
 * engine (header-detector.ts, alias-matcher.ts, cell-value.ts) rather than
 * duplicating it, resolved through a GradeSourceMapping the same way the JSON
 * adapter resolves its field mapping. Not built speculatively against a guess.
 */
export async function normalizeExcelRows(workbook: ExcelJS.Workbook, mapping: GradeFieldMapping): Promise<NormalizationResult> {
  throw new Error(
    `Excel grade adapter is not implemented yet (workbook has ${workbook.worksheets.length} sheet(s), ` +
    `mapping for fields: ${Object.keys(mapping).join(", ")})`
  );
}
