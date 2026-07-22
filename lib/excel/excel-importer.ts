import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { classifyDecision } from "@/lib/decision";
import { candidateNumberText, cellText } from "@/lib/excel/cell-value";
import { DecisionMappingRepository, type DecisionMappingLookup } from "@/lib/excel/decision-mapping-repository";
import { HeaderDetector } from "@/lib/excel/header-detector";
import { normalizeHeader } from "@/lib/excel/header-normalizer";
import { KnownSeriesRepository, type KnownSeriesLookup } from "@/lib/excel/known-series-repository";
import {
  canonicalFields,
  requiredFields,
  type CanonicalField,
  type ColumnMapping,
  type ImportReport,
  type NewSeries,
  type ParsedCandidate,
  type RowError,
  type UnknownDecision,
  type WorkbookInspection
} from "@/lib/excel/types";

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function optionalText(value: string) {
  const cleaned = cleanText(value);
  return cleaned || null;
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

function finalizeCandidate(raw: Record<string, unknown>, number: string, average: number, decision: string): ParsedCandidate {
  return {
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
  };
}

type PendingDecisionRow = { rowNumber: number; raw: Record<string, unknown>; rowErrors: RowError[]; average: number; number: string };
type PendingDecisionGroup = { rawValue: string; entries: PendingDecisionRow[] };

export class ExcelImporter {
  constructor(private readonly detector = new HeaderDetector()) {}

  async inspect(buffer: Buffer) {
    return this.detector.detect(await loadWorkbook(buffer));
  }

  async import(
    buffer: Buffer,
    inputMapping?: ColumnMapping,
    knownInspection?: WorkbookInspection,
    decisionLookup: DecisionMappingLookup = new DecisionMappingRepository(),
    seriesLookup: KnownSeriesLookup = new KnownSeriesRepository()
  ): Promise<ImportReport> {
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
    const pendingByKey = new Map<string, PendingDecisionGroup>();
    const decisionCounts = new Map<string, number>();
    let totalRows = 0;

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
      totalRows += 1;
      const rowErrors: RowError[] = [];
      for (const field of requiredFields) {
        if (!String(raw[field] ?? "").trim()) rowErrors.push({ rowNumber, field, message: "Missing required value", rawData: raw });
      }
      const average = Number(String(raw.average ?? "").replace(",", "."));
      if (!Number.isFinite(average) || average < 0 || average > 20) rowErrors.push({ rowNumber, field: "average", message: "Average must be between 0 and 20", rawData: raw });
      const isDuplicateNumber = Boolean(number && seen.has(number));
      if (isDuplicateNumber) rowErrors.push({ rowNumber, field: "candidateNumber", message: "Duplicate candidate number in file", rawData: raw });
      seen.add(number);

      const decisionText = String(raw.decision ?? "");
      if (!decisionText.trim()) {
        // A blank decision is a missing-value problem, not an unrecognized wording - never defer it.
        rowErrors.push({ rowNumber, field: "decision", message: "Unknown decision", rawData: raw });
        errors.push(...rowErrors);
        continue;
      }
      decisionCounts.set(cleanText(decisionText), (decisionCounts.get(cleanText(decisionText)) ?? 0) + 1);

      const decision = classifyDecision(decisionText);
      if (decision) {
        if (rowErrors.length) { errors.push(...rowErrors); continue; }
        rows.push(finalizeCandidate(raw, number, average, decision));
        continue;
      }

      // Text the hardcoded rules don't recognize: defer to the administrator-maintained synonym
      // table, resolved after the full pass in one batched lookup. A value never seen before -
      // known or not - is NEVER rejected: if it stays unresolved, the row is still kept, with the
      // raw text stored and displayed exactly as written (see the pass-through below).
      const normalizedKey = normalizeHeader(decisionText);
      const group = pendingByKey.get(normalizedKey) ?? { rawValue: cleanText(decisionText), entries: [] };
      group.entries.push({ rowNumber, raw, rowErrors, average, number });
      pendingByKey.set(normalizedKey, group);
    }

    const unknownDecisions: UnknownDecision[] = [];
    if (pendingByKey.size) {
      let resolved = new Map<string, string>();
      try {
        resolved = await decisionLookup.findResolved([...pendingByKey.keys()]);
      } catch {
        // The optional synonym table being unavailable must never block a real import -
        // every pending group simply falls through to the raw-text pass-through below.
      }
      for (const [normalizedKey, group] of pendingByKey) {
        const decision = resolved.get(normalizedKey) ?? group.rawValue;
        if (!resolved.has(normalizedKey)) unknownDecisions.push({ normalizedKey, rawValue: group.rawValue, count: group.entries.length });
        for (const entry of group.entries) {
          if (entry.rowErrors.length) { errors.push(...entry.rowErrors); continue; }
          rows.push(finalizeCandidate(entry.raw, entry.number, entry.average, decision));
        }
      }
      unknownDecisions.sort((left, right) => right.count - left.count);
    }

    // Purely informational: series has always been free text with no allowlist, so a
    // value not seen before is never rejected or deferred - just flagged for awareness.
    // A failure here (lookup unavailable, table not migrated yet, etc.) must never break
    // a real import over an informational nicety - it degrades to "nothing flagged."
    const seriesCounts = new Map<string, number>();
    for (const row of rows) seriesCounts.set(row.series, (seriesCounts.get(row.series) ?? 0) + 1);
    const distinctSeries = [...seriesCounts.keys()];
    let unknownSeriesValues: string[] = [];
    if (distinctSeries.length) {
      try {
        unknownSeriesValues = await seriesLookup.findUnknown(distinctSeries);
      } catch {
        unknownSeriesValues = [];
      }
    }
    const newSeries: NewSeries[] = unknownSeriesValues
      .map((series) => ({ series, count: seriesCounts.get(series) ?? 0 }))
      .sort((left, right) => right.count - left.count);

    const duplicateCounts = new Map<string, number>();
    for (const error of errors) {
      if (error.field !== "candidateNumber") continue;
      const number = String(error.rawData?.candidateNumber ?? "");
      if (number) duplicateCounts.set(number, (duplicateCounts.get(number) ?? 0) + 1);
    }
    const duplicateNumbers = [...duplicateCounts.entries()]
      .map(([candidateNumber, count]) => ({ candidateNumber, count: count + 1 }))
      .sort((left, right) => right.count - left.count);

    const decisionSummary = [...decisionCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 20);

    const invalidRows = new Set(errors.map((error) => error.rowNumber)).size;
    return {
      checksum: createHash("sha256").update(buffer).digest("hex"),
      totalRows,
      validRows: rows.length,
      invalidRows,
      preview: rows.slice(0, 20),
      rows,
      errors,
      unknownDecisions,
      newSeries,
      duplicateNumbers,
      decisionSummary,
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
export const importExcel = (
  buffer: Buffer,
  mapping?: ColumnMapping,
  inspection?: WorkbookInspection,
  decisionLookup?: DecisionMappingLookup,
  seriesLookup?: KnownSeriesLookup
) => importer.import(buffer, mapping, inspection, decisionLookup, seriesLookup);
