/** GRADED: a numeric mark from 0 to 20. EXEMPT: a valid row for a candidate with no numeric mark (e.g. exemption from EP/Physical Education) - mark is null in this case, never guessed. */
export type GradeStatus = "GRADED" | "EXEMPT";

export type NormalizedGradeRow = {
  examYear: number;
  examType: string;
  candidateNumber: string;
  series: string;
  subjectCode: string;
  /** Null exactly when status is EXEMPT. */
  mark: number | null;
  status: GradeStatus;
};

export type MalformedRow = {
  rowIndex: number;
  reason: string;
  rawData: unknown;
};

export type NormalizationResult = {
  rows: NormalizedGradeRow[];
  malformed: MalformedRow[];
};

/**
 * Which source field/column maps to each normalized field. Kept as plain data
 * (never hardcoded per-source in the adapters) so a differently-shaped source
 * is handled by supplying a different mapping, not by changing this library.
 */
export type GradeFieldMapping = {
  examYearField: string;
  examTypeField: string;
  candidateNumberField: string;
  seriesField: string;
  subjectCodeField: string;
  markField: string;
};
