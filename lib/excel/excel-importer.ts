import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { DECISIONS, MAX_UPLOAD_SIZE, type DecisionValue } from "@/lib/constants";
import { candidateNumberText, cellText } from "@/lib/excel/cell-value";
import { HeaderDetector } from "@/lib/excel/header-detector";
import {
  canonicalFields,
  requiredFields,
  type CanonicalField,
  type ColumnMapping,
  type ImportReport,
  type ParsedCandidate,
  type RowError,
  type WorkbookInspection
} from "@/lib/excel/types";

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function optionalText(value: string) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function normalizeValue(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isCancellationDecision(key: string) {
  const arabicExam = "\u0627\u0645\u062a\u062d\u0627\u0646";
  const arabicCancelled = "\u0645\u0644\u063a";
  const arabicCancellation = "\u0627\u0644\u063a\u0627\u0621";
  return key === "\u0645\u0644\u063a\u0649"
    || key === "\u0627\u0644\u063a\u0627\u0621\u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646"
    || (key.includes(arabicExam) && (key.includes(arabicCancelled) || key.includes(arabicCancellation)))
    || (key.includes("EXAMEN") && (key.includes("ANNULE") || key.includes("ANNULATION")))
    || key.startsWith("ANNULE")
    || key.startsWith("CANCELLED");
}
function mapDecision(value: string): DecisionValue | null {
  const key = normalizeValue(value);
  const values: Record<string, DecisionValue> = {
    ADMIS: "ADMIS",
    ADMITTED: "ADMIS",
    PASSED: "ADMIS",
    ناجح: "ADMIS",
    SESSIONNAIRE: "SESSIONNAIRE",
    SESSIONCOMPLEMENTAIRE: "SESSIONNAIRE",
    SUPPLEMENTARY: "SESSIONNAIRE",
    الدورةالتكميلية: "SESSIONNAIRE",
    REDOUBLE: "REDOUBLE",
    NONADMIS: "REDOUBLE",
    FAILED: "REDOUBLE",
    راسب: "REDOUBLE",
    ABSENT: "ABSENT",
    غائب: "ABSENT",
    ANNULE: "ANNULE",
    ANNULEE: "ANNULE",
    CANCELLED: "ANNULE",
    "\u0627\u0644\u063a\u0627\u0621\u0627\u0644\u0627\u0645\u062a\u062d\u0627\u0646": "ANNULE",
    ملغى: "ANNULE"
  };
  const mapped = values[key]
    ?? (key.startsWith("ADMIS") ? "ADMIS" : null)
    ?? (key.startsWith("AJOURNE") ? "REDOUBLE" : null)
    ?? (key.startsWith("SESSIONNAIRE") ? "SESSIONNAIRE" : null)
    ?? (key.startsWith("ABSENT") || key.startsWith("ABSCENT") ? "ABSENT" : null)
    ?? (isCancellationDecision(key) ? "ANNULE" : null)
    ?? key;
  return DECISIONS.includes(mapped as DecisionValue) ? mapped as DecisionValue : null;
}

function mappingFields(value: unknown): ColumnMapping {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: ColumnMapping = {};
  const allowed = new Set(canonicalFields.map((field) => field.key));
  for (const [field, column] of Object.entries(value)) {
    if (allowed.has(field as CanonicalField) && Number.isInteger(column) && Number(column) > 0) output[field as CanonicalField] = Number(column);
  }
  return output;
}

export function validateColumnMapping(value: unknown, inspection: WorkbookInspection) {
  const mapping = mappingFields(value);
  const available = new Set(inspection.columns.map((column) => column.index));
  const used = new Set<number>();
  for (const column of Object.values(mapping)) {
    if (!column || !available.has(column) || used.has(column)) throw new Error("INVALID_COLUMN_MAPPING");
    used.add(column);
  }
  return mapping;
}

export function parseMappingJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return mappingFields(JSON.parse(value));
  } catch {
    throw new Error("INVALID_COLUMN_MAPPING");
  }
}

export function missingRequiredFields(mapping: ColumnMapping) {
  return requiredFields.filter((field) => !mapping[field]);
}

async function loadWorkbook(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_UPLOAD_SIZE) throw new Error("FILE_SIZE");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

export class ExcelImporter {
  constructor(private readonly detector = new HeaderDetector()) {}

  async inspect(buffer: Buffer) {
    return this.detector.detect(await loadWorkbook(buffer));
  }

  async import(buffer: Buffer, inputMapping?: ColumnMapping, knownInspection?: WorkbookInspection): Promise<ImportReport> {
    const workbook = await loadWorkbook(buffer);
    const inspection = knownInspection ?? this.detector.detect(workbook);
    const mapping = validateColumnMapping(inputMapping ?? inspection.suggestedMapping, inspection);
    const missing = missingRequiredFields(mapping);
    if (missing.length) throw new MappingRequiredError(inspection, mapping);
    const sheet = workbook.worksheets[inspection.sheetIndex];
    if (!sheet) throw new Error("EMPTY_FILE");

    const rows: ParsedCandidate[] = [];
    const errors: RowError[] = [];
    const seen = new Set<string>();
    const mappedColumns = Object.values(mapping).filter((column): column is number => Boolean(column));

    for (let rowNumber = inspection.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!row.hasValues || mappedColumns.every((column) => !cellText(row.getCell(column)))) continue;
      const get = (field: CanonicalField) => mapping[field] ? cellText(row.getCell(mapping[field]!)) : "";
      const number = mapping.candidateNumber ? candidateNumberText(row.getCell(mapping.candidateNumber)) : "";
      const raw: Record<string, unknown> = {
        candidateNumber: number,
        fullName: get("fullName"),
        series: get("series"),
        average: get("average"),
        decision: get("decision"),
        wilaya: get("wilaya"),
        examCenter: get("examCenter"),
        school: get("school"),
        birthDate: get("birthDate"),
        birthPlace: get("birthPlace"),
        candidateType: get("candidateType")
      };
      const rowErrors: RowError[] = [];
      for (const field of requiredFields) {
        if (!String(raw[field] ?? "").trim()) rowErrors.push({ rowNumber, field, message: "Missing required value", rawData: raw });
      }
      const average = Number(String(raw.average ?? "").replace(",", "."));
      if (!Number.isFinite(average) || average < 0 || average > 20) rowErrors.push({ rowNumber, field: "average", message: "Average must be between 0 and 20", rawData: raw });
      const decision = mapDecision(String(raw.decision ?? ""));
      if (!decision) rowErrors.push({ rowNumber, field: "decision", message: "Unknown decision", rawData: raw });
      if (number && seen.has(number)) rowErrors.push({ rowNumber, field: "candidateNumber", message: "Duplicate candidate number in file", rawData: raw });
      seen.add(number);
      if (rowErrors.length || !decision) {
        errors.push(...rowErrors);
        continue;
      }
      rows.push({
        candidateNumber: number,
        fullName: cleanText(String(raw.fullName)),
        series: cleanText(String(raw.series)),
        average: Math.round(average * 100) / 100,
        decision,
        officialDecision: optionalText(String(raw.decision ?? "")),
        wilaya: optionalText(String(raw.wilaya ?? "")),
        examCenter: optionalText(String(raw.examCenter ?? "")),
        school: optionalText(String(raw.school ?? "")),
        birthDate: optionalText(String(raw.birthDate ?? "")),
        birthPlace: optionalText(String(raw.birthPlace ?? "")),
        candidateType: optionalText(String(raw.candidateType ?? ""))
      });
    }

    const invalidRows = new Set(errors.map((error) => error.rowNumber)).size;
    return {
      checksum: createHash("sha256").update(buffer).digest("hex"),
      totalRows: rows.length + invalidRows,
      validRows: rows.length,
      invalidRows,
      preview: rows.slice(0, 20),
      rows,
      errors,
      inspection,
      mapping
    };
  }
}

export class MappingRequiredError extends Error {
  constructor(public readonly inspection: WorkbookInspection, public readonly mapping: ColumnMapping) {
    super("MAPPING_REQUIRED");
    this.name = "MappingRequiredError";
  }
}

const importer = new ExcelImporter();
export const inspectExcel = (buffer: Buffer) => importer.inspect(buffer);
export const importExcel = (buffer: Buffer, mapping?: ColumnMapping, inspection?: WorkbookInspection) => importer.import(buffer, mapping, inspection);