"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { DECISIONS, type DecisionValue } from "@/lib/constants";
import { csrfFromDocument } from "@/lib/csrf-client";

type MappingRow = { id: string; rawValue: string; decision: DecisionValue | null; occurrences: number; updatedAt: string };

export function DecisionMappingsManager({ dict, pending, resolved }: { dict: AdminDictionary; pending: MappingRow[]; resolved: MappingRow[] }) {
  const router = useRouter();
  const [newRawValue, setNewRawValue] = useState("");
  const [newDecision, setNewDecision] = useState<DecisionValue | "">("");
  const [saving, setSaving] = useState(false);

  async function post(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      toast.error(dict.serviceUnavailable);
      return false;
    }
    return true;
  }

  async function resolvePending(row: MappingRow, decision: DecisionValue) {
    if (!(await post("/api/admin/decision-mappings", "POST", { rawValue: row.rawValue, decision }))) return;
    toast.success(dict.mappingSaved);
    router.refresh();
  }

  async function editResolved(row: MappingRow, decision: DecisionValue) {
    if (!(await post(`/api/admin/decision-mappings/${row.id}`, "PATCH", { decision }))) return;
    toast.success(dict.mappingSaved);
    router.refresh();
  }

  async function deleteMapping(id: string) {
    if (!confirm(dict.confirmDeleteMapping)) return;
    if (!(await post(`/api/admin/decision-mappings/${id}`, "DELETE"))) return;
    toast.success(dict.mappingDeleted);
    router.refresh();
  }

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newRawValue.trim() || !newDecision) return;
    setSaving(true);
    const ok = await post("/api/admin/decision-mappings", "POST", { rawValue: newRawValue.trim(), decision: newDecision });
    setSaving(false);
    if (!ok) return;
    toast.success(dict.mappingSaved);
    setNewRawValue("");
    setNewDecision("");
    router.refresh();
  }

  return <div className="mt-7 space-y-7">
    <section className="surface p-5">
      <h2 className="font-black">{dict.pendingMappings}</h2>
      {pending.length === 0 ? <p className="muted mt-3">{dict.noPendingDecisions}</p> : <ul className="mt-4 space-y-3">
        {pending.map((row) => <li key={row.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
          <p className="font-bold"><bdi>{row.rawValue}</bdi></p>
          <p className="muted mt-1 text-sm">{row.occurrences} {dict.affectedCandidates}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DECISIONS.map((decision) => <button key={decision} className="button secondary !min-h-9 !px-3 !text-xs" onClick={() => resolvePending(row, decision)}>{dict.decisions[decision]}</button>)}
          </div>
        </li>)}
      </ul>}
    </section>

    <section className="surface p-5">
      <h2 className="font-black">{dict.savedMappings}</h2>
      {resolved.length === 0 ? <p className="muted mt-3">{dict.noSavedMappings}</p> : <ul className="mt-4 space-y-3">
        {resolved.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
          <div><p className="font-bold"><bdi>{row.rawValue}</bdi></p><span className="badge mt-1">{dict.decisions[row.decision as DecisionValue]}</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field !w-auto !min-h-10 !py-1"
              aria-label={dict.edit}
              value={row.decision ?? ""}
              onChange={(event) => editResolved(row, event.target.value as DecisionValue)}
            >
              {DECISIONS.map((decision) => <option key={decision} value={decision}>{dict.decisions[decision]}</option>)}
            </select>
            <button className="button secondary !text-[var(--danger)]" onClick={() => deleteMapping(row.id)}>{dict.delete}</button>
          </div>
        </li>)}
      </ul>}
    </section>

    <section className="surface p-5">
      <h2 className="font-black">{dict.addMappingManually}</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" onSubmit={createManual}>
        <label><span className="label">{dict.rawValueLabel}</span><input className="field" value={newRawValue} onChange={(event) => setNewRawValue(event.target.value)} required /></label>
        <label><span className="label">{dict.decision}</span><select className="field" value={newDecision} onChange={(event) => setNewDecision(event.target.value as DecisionValue)} required>
          <option value="">{dict.decision}</option>
          {DECISIONS.map((decision) => <option key={decision} value={decision}>{dict.decisions[decision]}</option>)}
        </select></label>
        <button className="button" disabled={saving}>{saving ? "…" : dict.save}</button>
      </form>
    </section>
  </div>;
}
