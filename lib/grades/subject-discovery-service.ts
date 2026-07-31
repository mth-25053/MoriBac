import type { NormalizedGradeRow } from "@/lib/grades/types";
import { discoverSubjectSchemes, type DiscoveryReport, type ProposedScheme } from "@/lib/grades/subject-discovery";
import { DuplicateSubjectSchemeError, SubjectSchemeRepository } from "@/lib/grades/subject-scheme-repository";

export type ProposedSchemeWithStatus = ProposedScheme & { alreadyExists: boolean };
export type DiscoveryReportWithStatus = Omit<DiscoveryReport, "proposedSchemes"> & { proposedSchemes: ProposedSchemeWithStatus[] };

/**
 * Read-only: the only repository call is list() (a SELECT). Never creates,
 * updates, or deletes a SubjectScheme row - discovery is strictly a preview.
 * examYearId is null when the exam year itself doesn't exist yet, in which
 * case every proposal is trivially "not already existing" without a query.
 */
export async function buildDiscoveryReport(
  examYearId: string | null,
  examType: string,
  rows: NormalizedGradeRow[],
  repository: Pick<SubjectSchemeRepository, "list"> = new SubjectSchemeRepository()
): Promise<DiscoveryReportWithStatus> {
  const report = discoverSubjectSchemes(rows);
  const existing = examYearId ? await repository.list(examYearId, examType) : [];
  const existingKeys = new Set(existing.map((scheme) => `${scheme.series} ${scheme.subjectCode}`));
  return {
    ...report,
    proposedSchemes: report.proposedSchemes.map((scheme) => ({ ...scheme, alreadyExists: existingKeys.has(`${scheme.series} ${scheme.subjectCode}`) }))
  };
}

export type ConfirmedSchemeInput = {
  series: string;
  subjectCode: string;
  nameAr: string | null;
  nameFr: string | null;
  coefficient: number | null;
  displayOrder: number;
};

export type ConfirmedSchemeResult = { series: string; subjectCode: string; status: "created" | "duplicate" | "error"; message?: string };

/**
 * The explicit, separate write step - only reached after an admin reviews and
 * approves specific proposals. Reuses SubjectSchemeRepository.create verbatim
 * (Phase 4), so duplicate-identity and other invariants are enforced exactly
 * once, in one place. A duplicate or a single row's failure never aborts the
 * rest of the batch.
 */
export async function confirmDiscoveredSchemes(
  examYearId: string,
  examType: string,
  approved: ConfirmedSchemeInput[],
  repository: SubjectSchemeRepository = new SubjectSchemeRepository()
): Promise<ConfirmedSchemeResult[]> {
  const results: ConfirmedSchemeResult[] = [];
  for (const scheme of approved) {
    try {
      await repository.create({
        examYearId,
        examType,
        series: scheme.series,
        subjectCode: scheme.subjectCode,
        nameAr: scheme.nameAr,
        nameFr: scheme.nameFr,
        coefficient: scheme.coefficient,
        displayOrder: scheme.displayOrder
      });
      results.push({ series: scheme.series, subjectCode: scheme.subjectCode, status: "created" });
    } catch (error) {
      if (error instanceof DuplicateSubjectSchemeError) {
        results.push({ series: scheme.series, subjectCode: scheme.subjectCode, status: "duplicate" });
      } else {
        results.push({ series: scheme.series, subjectCode: scheme.subjectCode, status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return results;
}
