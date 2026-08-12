"use client";

import { useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fetchSubjectGrades, subjectDisplayName, type SubjectGradesState } from "@/lib/grades/subject-grades-client";

/**
 * Loads and displays subject grades automatically on mount - no click required.
 * The idle/button state was removed per product requirement: subjects must be
 * visible immediately, directly below the candidate's main result information.
 */
export function SubjectGradesSection({ candidateNumber, year, dict, locale }: { candidateNumber: string; year: number; dict: Dictionary; locale: Locale }) {
  const [state, setState] = useState<SubjectGradesState>({ status: "loading" });

  async function load() {
    setState({ status: "loading" });
    const result = await fetchSubjectGrades({ year, candidateNumber });
    setState(result);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateNumber, year]);

  // Complementary-session detail (S1/S2/retained) is self-describing: any row
  // carrying a non-null noteS1 came from the complementary import, never a
  // normal-session one. Detecting it this way (instead of threading a session
  // flag through every caller) keeps this component correct automatically for
  // both datasets with no extra prop.
  const isComplementary = state.status === "loaded" && state.grades.some((grade) => grade.noteS1 !== null && grade.noteS1 !== undefined);
  const title = isComplementary ? dict.subjectGradesTitleComplementary : dict.subjectGradesTitle;

  return <div className="relative z-[2] border-t p-5" style={{ borderColor: "var(--line)" }}>
    <p className="text-sm font-black">{title}</p>

    {state.status === "loading" && <p className="muted mt-3 text-sm" role="status">{dict.subjectGradesLoading}</p>}

    {state.status === "error" && <div className="mt-3">
      <p className="text-sm font-bold text-[var(--danger)]" role="alert">{dict.subjectGradesError}</p>
      <button type="button" className="button secondary mt-3" onClick={load}>{dict.retry}</button>
    </div>}

    {state.status === "empty" && <p className="muted mt-3 text-sm" role="status">{dict.subjectGradesUnavailable}</p>}

    {state.status === "loaded" && !isComplementary && <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
      {state.grades.map((grade) => <li key={`${grade.displayOrder}-${grade.subjectCode}`} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="min-w-0 truncate font-bold"><bdi>{subjectDisplayName(grade, locale)}</bdi></span>
        <span className="flex shrink-0 items-center gap-3 tabular-nums" dir="ltr">
          {grade.coefficient !== null && <span className="muted text-xs">×{grade.coefficient}</span>}
          {grade.status === "EXEMPT"
            ? <span className="font-black" dir="auto">{dict.exemptLabel}</span>
            : <span className="font-black">{(grade.mark as number).toFixed(2)} /20</span>}
        </span>
      </li>)}
    </ul>}

    {state.status === "loaded" && isComplementary && <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-start" style={{ borderColor: "var(--line)" }}>
            <th className="p-2 text-start font-bold">{dict.subjectColumnLabel}</th>
            <th className="p-2 text-center font-bold">{dict.coefficientColumnLabel}</th>
            <th className="p-2 text-center font-bold">{dict.subjectColumnFirstSession}</th>
            <th className="p-2 text-center font-bold">{dict.subjectColumnSecondSession}</th>
            <th className="p-2 text-center font-bold">{dict.subjectColumnRetained}</th>
          </tr>
        </thead>
        <tbody>
          {state.grades.map((grade) => <tr key={`${grade.displayOrder}-${grade.subjectCode}`} className="border-b" style={{ borderColor: "var(--line)" }}>
            <td className="min-w-0 truncate p-2 font-bold"><bdi>{subjectDisplayName(grade, locale)}</bdi></td>
            <td className="p-2 text-center tabular-nums" dir="ltr">{grade.coefficient !== null ? `×${grade.coefficient}` : "—"}</td>
            <td className="p-2 text-center tabular-nums" dir="ltr">{grade.noteS1 !== null && grade.noteS1 !== undefined ? grade.noteS1.toFixed(2) : "—"}</td>
            <td className="p-2 text-center tabular-nums" dir="ltr">{grade.noteS2 !== null && grade.noteS2 !== undefined ? grade.noteS2.toFixed(2) : "—"}</td>
            <td className="p-2 text-center font-black tabular-nums" dir="ltr">{grade.mark !== null ? grade.mark.toFixed(2) : "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </div>;
}
