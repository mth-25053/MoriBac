export type SubjectGradeRow = {
  subjectCode: string;
  nameAr: string | null;
  nameFr: string | null;
  coefficient: number | null;
  /** Null exactly when status is "EXEMPT". */
  mark: number | null;
  status: "GRADED" | "EXEMPT";
  displayOrder: number;
};

export type SubjectGradesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; grades: SubjectGradeRow[] }
  | { status: "empty" }
  | { status: "error" };

/**
 * Framework-independent fetch + state resolution, kept separate from the
 * rendering component so the idle/loading/loaded/empty/error transitions are
 * unit-testable without rendering anything - matches this codebase's existing
 * convention of testing logic, not components. The candidateNumber is passed
 * through untouched (URLSearchParams does not alter its digits/padding).
 */
export async function fetchSubjectGrades(
  input: { year: number; candidateNumber: string },
  fetchImpl: typeof fetch = fetch
): Promise<SubjectGradesState> {
  try {
    const query = new URLSearchParams({ year: String(input.year), number: input.candidateNumber });
    const response = await fetchImpl(`/api/public/candidate-grades?${query.toString()}`);
    if (!response.ok) return { status: "error" };
    const data: unknown = await response.json().catch(() => null);
    const grades = data && typeof data === "object" && Array.isArray((data as { grades?: unknown }).grades)
      ? (data as { grades: SubjectGradeRow[] }).grades
      : null;
    if (grades === null) return { status: "error" };
    return grades.length === 0 ? { status: "empty" } : { status: "loaded", grades };
  } catch {
    return { status: "error" };
  }
}

/**
 * subjectCode is a display fallback only - shown to a normal user solely when
 * both localized names are missing, per the product requirement never to
 * surface the raw code otherwise. The other locale's name (if present) is
 * preferred over the code, since a French label is still more informative
 * than "MT" to an Arabic-reading user, and vice versa.
 */
export function subjectDisplayName(grade: Pick<SubjectGradeRow, "subjectCode" | "nameAr" | "nameFr">, locale: "ar" | "fr") {
  const primary = locale === "ar" ? grade.nameAr : grade.nameFr;
  if (primary && primary.trim()) return primary;
  const secondary = locale === "ar" ? grade.nameFr : grade.nameAr;
  if (secondary && secondary.trim()) return secondary;
  return grade.subjectCode;
}
