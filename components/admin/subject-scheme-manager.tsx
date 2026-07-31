"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";

type Year = { id: string; year: number; isDefault: boolean };
type Scheme = { id: string; series: string; subjectCode: string; nameAr: string | null; nameFr: string | null; coefficient: number | null; displayOrder: number };
type SchemePatch = { nameAr: string | null; nameFr: string | null; coefficient: number | null; displayOrder: number };

const emptyForm = { series: "", subjectCode: "", nameAr: "", nameFr: "", coefficient: "", displayOrder: "0" };

export function SubjectSchemeManager({ dict, years, selectedYearId, schemes }: { dict: AdminDictionary; years: Year[]; selectedYearId: string | null; schemes: Scheme[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function selectYear(yearId: string) {
    const year = years.find((entry) => entry.id === yearId);
    if (year) router.push(`/admin/subject-schemes?year=${year.year}`);
  }

  async function addScheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedYearId || !form.series.trim() || !form.subjectCode.trim()) return;
    setSaving(true);
    const response = await fetch("/api/admin/subject-schemes", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
      body: JSON.stringify({
        examYearId: selectedYearId,
        series: form.series.trim(),
        subjectCode: form.subjectCode.trim(),
        nameAr: form.nameAr.trim() || null,
        nameFr: form.nameFr.trim() || null,
        coefficient: form.coefficient.trim() ? Number(form.coefficient) : null,
        displayOrder: Number(form.displayOrder) || 0
      })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return toast.error(data.error === "DUPLICATE_SUBJECT_SCHEME" ? dict.duplicateSubjectScheme : dict.serviceUnavailable);
    toast.success(dict.subjectSchemeSaved);
    setForm(emptyForm);
    router.refresh();
  }

  async function saveEdit(id: string, patch: SchemePatch) {
    setSaving(true);
    const response = await fetch(`/api/admin/subject-schemes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
      body: JSON.stringify(patch)
    });
    setSaving(false);
    if (!response.ok) return toast.error(dict.serviceUnavailable);
    toast.success(dict.subjectSchemeSaved);
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm(dict.confirmDeleteSubjectScheme)) return;
    const response = await fetch(`/api/admin/subject-schemes/${id}`, { method: "DELETE", headers: { "x-csrf-token": csrfFromDocument() } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.error === "SUBJECT_SCHEME_IN_USE" ? dict.subjectSchemeInUse : dict.serviceUnavailable);
    toast.success(dict.subjectSchemeDeleted);
    router.refresh();
  }

  const bySeries = schemes.reduce<Record<string, Scheme[]>>((acc, scheme) => {
    (acc[scheme.series] ??= []).push(scheme);
    return acc;
  }, {});

  return <div className="mt-7 space-y-7">
    <section className="surface p-5">
      <label>
        <span className="label">{dict.examYear}</span>
        <select className="field" value={selectedYearId ?? ""} onChange={(event) => selectYear(event.target.value)}>
          {years.map((year) => <option key={year.id} value={year.id}>BAC {year.year}</option>)}
        </select>
      </label>
    </section>

    {Object.keys(bySeries).length === 0 && <p className="muted">{dict.noSubjectSchemes}</p>}

    {Object.entries(bySeries).map(([series, rows]) => <section key={series} className="surface overflow-x-auto p-5">
      <h2 className="font-black">{series}</h2>
      <table className="mt-4 w-full text-start text-sm">
        <thead>
          <tr className="muted text-start">
            <th className="p-2 text-start">{dict.subjectCode}</th>
            <th className="p-2 text-start">{dict.subjectNameAr}</th>
            <th className="p-2 text-start">{dict.subjectNameFr}</th>
            <th className="p-2 text-start">{dict.coefficient}</th>
            <th className="p-2 text-start">{dict.displayOrder}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((scheme) => editingId === scheme.id
            ? <EditRow key={scheme.id} scheme={scheme} dict={dict} saving={saving} onCancel={() => setEditingId(null)} onSave={(patch) => saveEdit(scheme.id, patch)} />
            : <tr key={scheme.id}>
                <td className="p-2"><bdi className="font-bold">{scheme.subjectCode}</bdi></td>
                <td className="p-2"><bdi>{scheme.nameAr ?? "—"}</bdi></td>
                <td className="p-2"><bdi>{scheme.nameFr ?? "—"}</bdi></td>
                <td className="p-2">{scheme.coefficient ?? "—"}</td>
                <td className="p-2">{scheme.displayOrder}</td>
                <td className="flex gap-2 p-2">
                  <button className="button secondary" onClick={() => setEditingId(scheme.id)}>{dict.edit}</button>
                  <button className="button secondary !text-[var(--danger)]" onClick={() => remove(scheme.id)}>{dict.delete}</button>
                </td>
              </tr>)}
        </tbody>
      </table>
    </section>)}

    <section className="surface p-5">
      <h2 className="font-black">{dict.addSubjectScheme}</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={addScheme}>
        <label><span className="label">{dict.series}</span><input className="field" value={form.series} onChange={(event) => setForm({ ...form, series: event.target.value })} required /></label>
        <label><span className="label">{dict.subjectCode}</span><input className="field" value={form.subjectCode} onChange={(event) => setForm({ ...form, subjectCode: event.target.value })} required /></label>
        <label><span className="label">{dict.displayOrder}</span><input type="number" className="field" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} /></label>
        <label><span className="label">{dict.subjectNameAr}</span><input className="field" value={form.nameAr} onChange={(event) => setForm({ ...form, nameAr: event.target.value })} /></label>
        <label><span className="label">{dict.subjectNameFr}</span><input className="field" value={form.nameFr} onChange={(event) => setForm({ ...form, nameFr: event.target.value })} /></label>
        <label><span className="label">{dict.coefficient}</span><input type="number" step="0.01" className="field" value={form.coefficient} onChange={(event) => setForm({ ...form, coefficient: event.target.value })} /></label>
        <button className="button sm:col-span-3" disabled={saving || !selectedYearId}>{saving ? "…" : dict.save}</button>
      </form>
    </section>
  </div>;
}

function EditRow({ scheme, dict, saving, onCancel, onSave }: { scheme: Scheme; dict: AdminDictionary; saving: boolean; onCancel: () => void; onSave: (patch: SchemePatch) => void }) {
  const [nameAr, setNameAr] = useState(scheme.nameAr ?? "");
  const [nameFr, setNameFr] = useState(scheme.nameFr ?? "");
  const [coefficient, setCoefficient] = useState(scheme.coefficient?.toString() ?? "");
  const [displayOrder, setDisplayOrder] = useState(scheme.displayOrder.toString());

  return <tr>
    <td className="p-2"><bdi className="font-bold">{scheme.subjectCode}</bdi></td>
    <td className="p-2"><input className="field" value={nameAr} onChange={(event) => setNameAr(event.target.value)} /></td>
    <td className="p-2"><input className="field" value={nameFr} onChange={(event) => setNameFr(event.target.value)} /></td>
    <td className="p-2"><input type="number" step="0.01" className="field" value={coefficient} onChange={(event) => setCoefficient(event.target.value)} /></td>
    <td className="p-2"><input type="number" className="field" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} /></td>
    <td className="flex gap-2 p-2">
      <button
        className="button"
        disabled={saving}
        onClick={() => onSave({ nameAr: nameAr.trim() || null, nameFr: nameFr.trim() || null, coefficient: coefficient.trim() ? Number(coefficient) : null, displayOrder: Number(displayOrder) || 0 })}
      >
        {dict.save}
      </button>
      <button className="button secondary" onClick={onCancel}>{dict.cancel}</button>
    </td>
  </tr>;
}
