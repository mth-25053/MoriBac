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

  return <div className="relative z-[2] border-t p-5" style={{ borderColor: "var(--line)" }}>
    <p className="text-sm font-black">{dict.subjectGradesTitle}</p>

    {state.status === "loading" && <p className="muted mt-3 text-sm" role="status">{dict.subjectGradesLoading}</p>}

    {state.status === "error" && <div className="mt-3">
      <p className="text-sm font-bold text-[var(--danger)]" role="alert">{dict.subjectGradesError}</p>
      <button type="button" className="button secondary mt-3" onClick={load}>{dict.retry}</button>
    </div>}

    {state.status === "empty" && <p className="muted mt-3 text-sm" role="status">{dict.subjectGradesUnavailable}</p>}

    {state.status === "loaded" && <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
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
  </div>;
}
