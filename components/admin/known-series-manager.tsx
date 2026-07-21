"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";

type SeriesRow = { code: string; createdAt: string };

export function KnownSeriesManager({ dict, series }: { dict: AdminDictionary; series: SeriesRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    const response = await fetch("/api/admin/known-series", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
      body: JSON.stringify({ code: code.trim() })
    });
    setSaving(false);
    if (!response.ok) return toast.error(dict.serviceUnavailable);
    toast.success(dict.seriesAdded);
    setCode("");
    router.refresh();
  }

  async function remove(rowCode: string) {
    if (!confirm(dict.confirmDeleteSeries)) return;
    const response = await fetch(`/api/admin/known-series/${encodeURIComponent(rowCode)}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfFromDocument() }
    });
    if (!response.ok) return toast.error(dict.serviceUnavailable);
    toast.success(dict.seriesDeleted);
    router.refresh();
  }

  return <div className="mt-7 space-y-7">
    <section className="surface p-5">
      <h2 className="font-black">{dict.knownSeriesNav}</h2>
      {series.length === 0 ? <p className="muted mt-3">{dict.noKnownSeries}</p> : <ul className="mt-4 flex flex-wrap gap-2">
        {series.map((row) => <li key={row.code} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold" style={{ borderColor: "var(--line)" }}>
          <bdi>{row.code}</bdi>
          <button className="text-[var(--danger)]" aria-label={dict.delete} onClick={() => remove(row.code)}>×</button>
        </li>)}
      </ul>}
    </section>

    <section className="surface p-5">
      <h2 className="font-black">{dict.addSeries}</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={add}>
        <label><span className="label">{dict.seriesCode}</span><input className="field" value={code} onChange={(event) => setCode(event.target.value)} required /></label>
        <button className="button" disabled={saving}>{saving ? "…" : dict.save}</button>
      </form>
    </section>
  </div>;
}
