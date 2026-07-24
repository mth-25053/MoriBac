export type RankingCandidate = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: string;
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
};

export type RankingStatistics = {
  total: number;
  passed: number;
  session: number;
  failed: number;
  cancelled: number;
  absent: number;
  highest: number;
  lowest: number;
  successRate: number;
};

export type FilterOptions = {
  series: string[];
  wilayas: string[];
  centers: string[];
  schools: string[];
};

export type RankingsResponse = {
  candidates: RankingCandidate[];
  total: number;
  pageCount: number;
  statistics: RankingStatistics | null;
};

export type RankingsScope = "national" | "series" | "wilaya" | "school" | "center";

export function rankingsScope(filters: { series: string; wilaya: string; school: string; examCenter: string }): RankingsScope {
  if (filters.school) return "school";
  if (filters.examCenter) return "center";
  if (filters.wilaya) return "wilaya";
  if (filters.series) return "series";
  return "national";
}
