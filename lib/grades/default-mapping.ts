import type { GradeFieldMapping } from "@/lib/grades/types";

/**
 * Default field mapping used until a GradeSourceMapping-backed configuration
 * screen exists (a later phase - the table was created in Phase 1 for this
 * purpose but isn't wired up yet). Matches the shape of the first real
 * dataset's normalized JSON. A differently-shaped JSON source needs its own
 * mapping passed to normalizeJsonRows - never a change to the adapter itself.
 */
export const DEFAULT_JSON_FIELD_MAPPING: GradeFieldMapping = {
  examYearField: "examYear",
  examTypeField: "exam",
  candidateNumberField: "candidateNumber",
  seriesField: "series",
  subjectCodeField: "subjectCode",
  markField: "mark"
};
