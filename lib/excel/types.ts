import type { DecisionValue } from "@/lib/constants";

export const canonicalFields = [
  { key: "candidateNumber", label: "Candidate Number", required: true },
  { key: "fullName", label: "Full Name", required: true },
  { key: "series", label: "Series", required: true },
  { key: "average", label: "Average", required: true },
  { key: "decision", label: "Decision", required: true },
  { key: "wilaya", label: "Wilaya", required: false },
  { key: "examCenter", label: "Exam Center", required: false },
  { key: "school", label: "School", required: false },
  { key: "birthDate", label: "Birth Date", required: false },
  { key: "birthPlace", label: "Birth Place", required: false },
  { key: "candidateType", label: "Candidate Type", required: false }
] as const;

export type CanonicalField = (typeof canonicalFields)[number]["key"];
export const requiredFields = canonicalFields.filter((field) => field.required).map((field) => field.key) as CanonicalField[];
export const optionalFields = canonicalFields.filter((field) => !field.required).map((field) => field.key) as CanonicalField[];

export type ColumnMapping = Partial<Record<CanonicalField, number>>;

export type DetectedColumn = {
  index: number;
  header: string;
  normalized: string;
};

export type WorkbookInspection = {
  sheetIndex: number;
  sheetName: string;
  headerRow: number;
  columns: DetectedColumn[];
  structureKey: string;
  suggestedMapping: ColumnMapping;
  confidence: Partial<Record<CanonicalField, number>>;
  unresolvedRequired: CanonicalField[];
  sheetsScanned: number;
};

export type ParsedCandidate = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: DecisionValue;
  officialDecision: string | null;
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  candidateType: string | null;
};

export type RowError = {
  rowNumber: number;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
};

export type UnknownDecision = {
  normalizedKey: string;
  rawValue: string;
  count: number;
};

export type NewSeries = {
  series: string;
  count: number;
};

export type ImportReport = {
  checksum: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: ParsedCandidate[];
  rows: ParsedCandidate[];
  errors: RowError[];
  unknownDecisions: UnknownDecision[];
  newSeries: NewSeries[];
  inspection: WorkbookInspection;
  mapping: ColumnMapping;
};