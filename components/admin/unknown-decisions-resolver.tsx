"use client";

import { useState } from "react";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { DECISIONS, type DecisionValue } from "@/lib/constants";
import type { UnknownDecision } from "@/lib/excel/types";

export function UnknownDecisionsResolver({
  dict,
  unknownDecisions,
  loading,
  onConfirm
}: {
  dict: AdminDictionary;
  unknownDecisions: UnknownDecision[];
  loading: boolean;
  onConfirm: (resolutions: { rawValue: string; decision: DecisionValue }[]) => void;
}) {
  const [selections, setSelections] = useState<Record<string, DecisionValue | "">>(
    () => Object.fromEntries(unknownDecisions.map((item) => [item.normalizedKey, ""]))
  );
  const complete = unknownDecisions.every((item) => selections[item.normalizedKey]);

  function select(normalizedKey: string, decision: DecisionValue) {
    setSelections((current) => ({ ...current, [normalizedKey]: decision }));
  }

  function confirm() {
    if (!complete) return;
    onConfirm(unknownDecisions.map((item) => ({ rawValue: item.rawValue, decision: selections[item.normalizedKey] as DecisionValue })));
  }

  return <section className="surface mt-7 overflow-hidden" aria-labelledby="unknown-decisions-title">
    <div className="border-b p-5 md:p-7" style={{ borderColor: "var(--line)" }}>
      <span className="eyebrow">{dict.unknownDecisionsNav}</span>
      <h2 id="unknown-decisions-title" className="mt-2 text-2xl font-black">{dict.unknownDecisionsDetected}: {unknownDecisions.length}</h2>
    </div>
    <div className="grid gap-4 p-5 md:p-7">
      {unknownDecisions.map((item) => <div key={item.normalizedKey} className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
        <p className="font-bold">{dict.unknownDecisionPrompt}</p>
        <p className="muted mt-2 text-sm">{dict.unknownValueLabel}: <b className="text-[var(--text)]">“<bdi>{item.rawValue}</bdi>”</b></p>
        <p className="muted mt-1 text-sm">{item.count} {dict.affectedCandidates}</p>
        <fieldset className="mt-4 flex flex-wrap gap-4">
          {DECISIONS.map((decision) => <label key={decision} className="flex items-center gap-2 text-sm font-bold">
            <input
              type="radio"
              name={`decision-${item.normalizedKey}`}
              checked={selections[item.normalizedKey] === decision}
              onChange={() => select(item.normalizedKey, decision)}
            />
            {dict.decisions[decision]}
          </label>)}
        </fieldset>
      </div>)}
      <button className="button" disabled={!complete || loading} onClick={confirm}>{loading ? "…" : dict.confirmDecisions}</button>
    </div>
  </section>;
}
