import type { GradeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";

export type PublicSubjectGrade = {
  subjectCode: string;
  nameAr: string | null;
  nameFr: string | null;
  coefficient: number | null;
  /** Null exactly when status is "EXEMPT". */
  mark: number | null;
  /** Complementary-session detail only - null for every normal-session row. */
  noteS1: number | null;
  noteS2: number | null;
  status: GradeStatus;
  displayOrder: number;
};

/**
 * Candidate-specific only - there is no equivalent "all candidates" query
 * anywhere in this module, by design. Returns null when the candidate itself
 * doesn't exist for this exam year (caller treats that the same as "no grades
 * yet", matching how findCandidateResult's null already behaves for the base
 * search route - never distinguishing "wrong number" from "not published").
 */
export async function getCandidateSubjectGrades(examYearId: string, candidateNumber: string, database = db): Promise<PublicSubjectGrade[] | null> {
  const candidate = await withDatabaseRetry(
    () => database.candidate.findUnique({
      where: { examYearId_candidateNumber: { examYearId, candidateNumber } },
      select: { id: true }
    }),
    "public-candidate-grades-candidate-lookup",
    { maxAttempts: 3, timeoutMs: 12_000 }
  );
  if (!candidate) return null;

  const grades = await withDatabaseRetry(
    () => database.candidateSubjectGrade.findMany({
      where: { candidateId: candidate.id },
      orderBy: { subjectScheme: { displayOrder: "asc" } },
      select: {
        mark: true,
        noteS1: true,
        noteS2: true,
        status: true,
        subjectScheme: { select: { subjectCode: true, nameAr: true, nameFr: true, coefficient: true, displayOrder: true } }
      }
    }),
    "public-candidate-grades-read",
    { maxAttempts: 3, timeoutMs: 20_000 }
  );

  return grades.map((grade) => ({
    subjectCode: grade.subjectScheme.subjectCode,
    nameAr: grade.subjectScheme.nameAr,
    nameFr: grade.subjectScheme.nameFr,
    coefficient: grade.subjectScheme.coefficient === null ? null : Number(grade.subjectScheme.coefficient),
    mark: grade.mark === null ? null : Number(grade.mark),
    noteS1: grade.noteS1 === null ? null : Number(grade.noteS1),
    noteS2: grade.noteS2 === null ? null : Number(grade.noteS2),
    status: grade.status,
    displayOrder: grade.subjectScheme.displayOrder
  }));
}
