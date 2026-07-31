import type { GradeFieldMapping, NormalizationResult } from "@/lib/grades/types";

export type CsvSource = {
  headerRow: string[];
  dataRows: string[][];
};

/**
 * Contract only. No real CSV subject-grade file exists yet to design the parsing
 * (delimiter/quoting edge cases, header-matching tolerance) against - BAC 2026
 * arrived as normalized JSON. Implementing this against a guessed shape would
 * risk building the wrong thing; the signature is fixed now so validate.ts and
 * every caller can depend on the shared contract without changes once this is
 * built against a real sample.
 */
export function normalizeCsvRows(source: CsvSource, mapping: GradeFieldMapping): NormalizationResult {
  throw new Error(
    `CSV grade adapter is not implemented yet (received ${source.headerRow.length} header column(s), ` +
    `${source.dataRows.length} data row(s), mapping for fields: ${Object.keys(mapping).join(", ")})`
  );
}
