import { DECISIONS, type DecisionValue } from "@/lib/constants";
import { normalizeHeader } from "@/lib/excel/header-normalizer";

function isCancellationDecision(key: string) {
  const arabicExam = "امتحان";
  const arabicCancelled = "ملغ";
  const arabicCancellation = "الغاء";
  return key === "ملغى"
    || key === "الغاءالامتحان"
    || (key.includes(arabicExam) && (key.includes(arabicCancelled) || key.includes(arabicCancellation)))
    || (key.includes("EXAMEN") && (key.includes("ANNULE") || key.includes("ANNULATION")))
    || key.startsWith("ANNULE")
    || key.startsWith("CANCELLED");
}

/**
 * Classifies a raw decision string into one of the 5 known buckets used for
 * special UI treatment (celebration, badge tone, rank exclusion), or null when
 * the text isn't recognized. Returning null is never an error - the caller
 * always has a safe fallback: store/display the raw text as-is.
 *
 * This is the single source of truth for "known decision" recognition, shared
 * by the importer (to normalize known synonyms at write time) and by the
 * public/admin UI (to classify whatever raw string is already stored, since a
 * value written before a synonym was recognized still needs consistent tone).
 */
export function classifyDecision(value: string): DecisionValue | null {
  const key = normalizeHeader(value);
  if (!key) return null;
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
    "الغاءالامتحان": "ANNULE",
    ملغى: "ANNULE"
  };
  const mapped = values[key]
    ?? (key.startsWith("ADMIS") ? "ADMIS" : null)
    ?? (key.startsWith("AJOURNE") ? "REDOUBLE" : null)
    ?? (key.startsWith("SESSIONNAIRE") ? "SESSIONNAIRE" : null)
    ?? (key.startsWith("ABSENT") || key.startsWith("ABSCENT") ? "ABSENT" : null)
    ?? (isCancellationDecision(key) ? "ANNULE" : null)
    ?? key;
  return DECISIONS.includes(mapped as DecisionValue) ? (mapped as DecisionValue) : null;
}

/** Tone bucket for arbitrary stored decision text - unrecognized values get the same calm, non-alarming treatment as REDOUBLE/ABSENT. */
export function decisionBadgeClass(decision: string) {
  const known = classifyDecision(decision);
  if (known === "ANNULE") return "cancelled";
  if (known === "ADMIS") return "";
  return "calm";
}

/** Excludes ANNULE (known or recognized-synonym) from ranking; any other value, known or not, counts. */
export function candidateRank(decision: string, rank: number) {
  return classifyDecision(decision) === "ANNULE" ? null : rank;
}
