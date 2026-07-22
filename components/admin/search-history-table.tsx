"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";

export type SearchHistoryRow = { candidateNumber: string; year: number; lastSearchedAt: string; found: boolean; count: number };

export function SearchHistoryTable({ rows, years, dict }: { rows: SearchHistoryRow[]; years: number[]; dict: AdminDictionary }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clearing, setClearing] = useState(false);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const number = String(form.get("number") ?? "").trim();
    const year = String(form.get("year") ?? "");
    const found = String(form.get("found") ?? "");
    if (number) params.set("number", number);
    if (year) params.set("year", year);
    if (found) params.set("found", found);
    router.push(`/admin/search-history${params.toString() ? `?${params}` : ""}`);
  }

  function clearFilters() {
    router.push("/admin/search-history");
  }

  async function clearHistory() {
    if (!confirm(dict.confirmClearHistory)) return;
    setClearing(true);
    const response = await fetch("/api/admin/search-history", { method: "DELETE", headers: { "x-csrf-token": csrfFromDocument() } });
    setClearing(false);
    if (!response.ok) return toast.error(dict.serviceUnavailable);
    toast.success(dict.historyCleared);
    router.refresh();
  }

  return <div className="space-y-5">
    <form className="surface flex flex-wrap items-end gap-3 p-5" onSubmit={applyFilters}>
      <label><span className="label">{dict.candidateNumber}</span><input name="number" defaultValue={searchParams.get("number") ?? ""} className="field !w-auto" /></label>
      <label><span className="label">{dict.examYear}</span>
        <select name="year" defaultValue={searchParams.get("year") ?? ""} className="field !w-auto">
          <option value="">{dict.allYears}</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <label><span className="label">{dict.resultFound}</span>
        <select name="found" defaultValue={searchParams.get("found") ?? ""} className="field !w-auto">
          <option value="">{dict.allResults}</option>
          <option value="yes">{dict.foundYes}</option>
          <option value="no">{dict.foundNo}</option>
        </select>
      </label>
      <button className="button">{dict.apply}</button>
      <button type="button" className="button secondary" onClick={clearFilters}>{dict.clear}</button>
      <button type="button" className="button ms-auto" style={{ background: "var(--danger)" }} disabled={clearing} onClick={clearHistory}>{dict.clearHistory}</button>
    </form>

    <div className="surface overflow-hidden">
      {rows.length === 0 ? <p className="muted p-8 text-center">{dict.noSearchHistory}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[var(--surface-2)]"><tr>
        {[dict.candidateNumber, dict.examYear, dict.lastSearched, dict.resultFound, dict.searchCount].map((heading) => <th className="p-4 text-start" key={heading}>{heading}</th>)}
      </tr></thead><tbody>{rows.map((row) => <tr className="border-t" style={{ borderColor: "var(--line)" }} key={`${row.candidateNumber}:${row.year}`}>
        <td className="p-4 font-mono" dir="ltr">{row.candidateNumber}</td>
        <td className="p-4">{row.year}</td>
        <td className="p-4" dir="ltr">{new Date(row.lastSearchedAt).toLocaleString()}</td>
        <td className="p-4"><span className={`badge ${row.found ? "" : "cancelled"}`}>{row.found ? dict.foundYes : dict.foundNo}</span></td>
        <td className="p-4 font-bold tabular-nums">{row.count}</td>
      </tr>)}</tbody></table></div>}
    </div>
  </div>;
}
