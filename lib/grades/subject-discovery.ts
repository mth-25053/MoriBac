import type { NormalizedGradeRow } from "@/lib/grades/types";

export type SubjectCount = { subjectCode: string; candidateCount: number; rowCount: number };
export type DiscoveredSeries = { series: string; subjects: SubjectCount[] };
export type SharedSubject = { subjectCode: string; series: string[] };
export type UniqueSubject = { subjectCode: string; series: string };
/** Distinct raw subjectCode spellings that collapse to the same code once case/whitespace/accents are normalized away - the closest thing to a "naming inconsistency" check the data shape supports (no separate subject-name field exists in a NormalizedGradeRow). */
export type CodeVariantGroup = { normalized: string; variants: { raw: string; count: number }[] };

export type ProposedScheme = {
  examYear: number;
  examType: string;
  series: string;
  subjectCode: string;
  /** Always null out of discovery - there is no name field in the source to seed this from. Filled in by an admin, never guessed. */
  nameAr: string | null;
  nameFr: string | null;
  /** Always null out of discovery - never guessed. */
  coefficient: null;
  coefficientRequiresConfirmation: true;
  displayOrder: number;
  candidateCount: number;
  rowCount: number;
};

export type DiscoveryReport = {
  examYear: number | null;
  examType: string | null;
  totalRows: number;
  distinctSeries: string[];
  seriesBreakdown: DiscoveredSeries[];
  sharedSubjects: SharedSubject[];
  uniqueSubjects: UniqueSubject[];
  codeVariantGroups: CodeVariantGroup[];
  proposedSchemes: ProposedScheme[];
};

function normalizeCodeForComparison(code: string) {
  return code.trim().toUpperCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Pure, read-only analysis of already-normalized grade rows - no database
 * access anywhere in this module. Never proposes a coefficient or a name;
 * both are left null/none and explicitly flagged as requiring confirmation,
 * per the rule that discovery must never guess.
 */
export function discoverSubjectSchemes(rows: NormalizedGradeRow[]): DiscoveryReport {
  if (rows.length === 0) {
    return { examYear: null, examType: null, totalRows: 0, distinctSeries: [], seriesBreakdown: [], sharedSubjects: [], uniqueSubjects: [], codeVariantGroups: [], proposedSchemes: [] };
  }

  const examYear = rows[0].examYear;
  const examType = rows[0].examType;

  const bySeries = new Map<string, Map<string, { candidates: Set<string>; rowCount: number; firstSeenIndex: number }>>();
  const variantTracker = new Map<string, Map<string, number>>();

  rows.forEach((row, index) => {
    const seriesMap = bySeries.get(row.series) ?? new Map();
    bySeries.set(row.series, seriesMap);
    const entry = seriesMap.get(row.subjectCode) ?? { candidates: new Set<string>(), rowCount: 0, firstSeenIndex: index };
    entry.candidates.add(row.candidateNumber);
    entry.rowCount += 1;
    seriesMap.set(row.subjectCode, entry);

    const normalized = normalizeCodeForComparison(row.subjectCode);
    const variants = variantTracker.get(normalized) ?? new Map<string, number>();
    variants.set(row.subjectCode, (variants.get(row.subjectCode) ?? 0) + 1);
    variantTracker.set(normalized, variants);
  });

  const distinctSeries = [...bySeries.keys()].sort();

  const seriesBreakdown: DiscoveredSeries[] = distinctSeries.map((series) => {
    const seriesMap = bySeries.get(series)!;
    const subjects = [...seriesMap.entries()]
      .sort((a, b) => a[1].firstSeenIndex - b[1].firstSeenIndex)
      .map(([subjectCode, info]) => ({ subjectCode, candidateCount: info.candidates.size, rowCount: info.rowCount }));
    return { series, subjects };
  });

  const codeToSeries = new Map<string, Set<string>>();
  for (const [series, seriesMap] of bySeries) {
    for (const subjectCode of seriesMap.keys()) {
      const set = codeToSeries.get(subjectCode) ?? new Set<string>();
      set.add(series);
      codeToSeries.set(subjectCode, set);
    }
  }

  const sharedSubjects: SharedSubject[] = [];
  const uniqueSubjects: UniqueSubject[] = [];
  for (const [subjectCode, seriesSet] of codeToSeries) {
    if (seriesSet.size > 1) sharedSubjects.push({ subjectCode, series: [...seriesSet].sort() });
    else uniqueSubjects.push({ subjectCode, series: [...seriesSet][0] });
  }
  sharedSubjects.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
  uniqueSubjects.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));

  const codeVariantGroups: CodeVariantGroup[] = [...variantTracker.entries()]
    .filter(([, variants]) => variants.size > 1)
    .map(([normalized, variants]) => ({
      normalized,
      variants: [...variants.entries()].map(([raw, count]) => ({ raw, count })).sort((a, b) => b.count - a.count)
    }));

  const proposedSchemes: ProposedScheme[] = [];
  for (const { series, subjects } of seriesBreakdown) {
    subjects.forEach((subject, displayOrder) => {
      proposedSchemes.push({
        examYear,
        examType,
        series,
        subjectCode: subject.subjectCode,
        nameAr: null,
        nameFr: null,
        coefficient: null,
        coefficientRequiresConfirmation: true,
        displayOrder,
        candidateCount: subject.candidateCount,
        rowCount: subject.rowCount
      });
    });
  }

  return { examYear, examType, totalRows: rows.length, distinctSeries, seriesBreakdown, sharedSubjects, uniqueSubjects, codeVariantGroups, proposedSchemes };
}
