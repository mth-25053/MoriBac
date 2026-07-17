import type { DecisionValue } from "@/lib/constants";

export function decisionBadgeClass(decision: DecisionValue) {
  if (decision === "ANNULE") return "cancelled";
  return decision === "REDOUBLE" || decision === "ABSENT" ? "fail" : "";
}

export function candidateRank(decision: DecisionValue, rank: number) {
  return decision === "ANNULE" ? null : rank;
}