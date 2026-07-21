export { HeaderDetector } from "@/lib/excel/header-detector";
export { HeaderNormalizer, normalizeHeader } from "@/lib/excel/header-normalizer";
export { AliasMatcher } from "@/lib/excel/alias-matcher";
export {
  ExcelImporter,
  MappingRequiredError,
  importExcel,
  inspectExcel,
  missingRequiredFields,
  parseMappingJson,
  validateColumnMapping
} from "@/lib/excel/excel-importer";
export type {
  CanonicalField,
  ColumnMapping,
  DetectedColumn,
  ImportReport,
  ParsedCandidate,
  RowError,
  UnknownDecision,
  WorkbookInspection
} from "@/lib/excel/types";
export { canonicalFields, optionalFields, requiredFields } from "@/lib/excel/types";
export type { DecisionMappingLookup } from "@/lib/excel/decision-mapping-repository";

import { importExcel } from "@/lib/excel/excel-importer";
import type { DecisionMappingLookup } from "@/lib/excel/decision-mapping-repository";
import type { ColumnMapping, WorkbookInspection } from "@/lib/excel/types";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";

export function validateExcelFile(buffer: Buffer, fileName: string, mimeType = "") {
  if (!/\.xlsx$/i.test(fileName)) throw new Error("INVALID_FILE_TYPE");
  const allowedTypes = new Set(["", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]);
  if (!allowedTypes.has(mimeType)) throw new Error("INVALID_FILE_TYPE");
  if (!buffer.length || buffer.length > MAX_UPLOAD_SIZE) throw new Error("FILE_SIZE");
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error("INVALID_XLSX_SIGNATURE");
}

export const parseExcel = (buffer: Buffer, mapping?: ColumnMapping, inspection?: WorkbookInspection, decisionLookup?: DecisionMappingLookup) =>
  importExcel(buffer, mapping, inspection, decisionLookup);