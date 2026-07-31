"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";
import { DIRECT_UPLOAD_LIMIT, IMPORT_CHUNK_SIZE } from "@/lib/import-upload-config";

type ProposedScheme = {
  series: string;
  subjectCode: string;
  nameAr: string | null;
  nameFr: string | null;
  coefficientRequiresConfirmation: true;
  displayOrder: number;
  candidateCount: number;
  rowCount: number;
  alreadyExists: boolean;
};

type DiscoveryReport = {
  totalRows: number;
  malformedRowCount: number;
  distinctSeries: string[];
  sharedSubjects: { subjectCode: string; series: string[] }[];
  uniqueSubjects: { subjectCode: string; series: string }[];
  codeVariantGroups: { normalized: string; variants: { raw: string; count: number }[] }[];
  proposedSchemes: ProposedScheme[];
};

type EditableRow = ProposedScheme & { selected: boolean; nameArDraft: string; nameFrDraft: string; coefficientDraft: string };

export function SubjectSchemeDiscovery({ dict }: { dict: AdminDictionary }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function parsedResponse(response: Response) {
    const text = await response.text();
    if (!text) return {} as Record<string, unknown>;
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return { error: "INVALID_SERVER_RESPONSE" }; }
  }

  async function uploadLargeFile(targetFile: File) {
    if (targetFile.size <= DIRECT_UPLOAD_LIMIT) return null;
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(targetFile.size / IMPORT_CHUNK_SIZE);
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const chunk = targetFile.slice(chunkIndex * IMPORT_CHUNK_SIZE, Math.min(targetFile.size, (chunkIndex + 1) * IMPORT_CHUNK_SIZE));
      const body = new FormData();
      body.set("uploadId", uploadId);
      body.set("fileName", targetFile.name);
      body.set("mimeType", targetFile.type || "application/json");
      body.set("fileSize", String(targetFile.size));
      body.set("totalChunks", String(totalChunks));
      body.set("chunkIndex", String(chunkIndex));
      body.set("chunk", chunk, targetFile.name + ".part");
      const response = await fetch("/api/admin/grade-import/upload", { method: "POST", headers: { "x-csrf-token": csrfFromDocument() }, body });
      if (!response.ok) {
        toast.error(dict.serviceUnavailable);
        return null;
      }
    }
    return uploadId;
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    try {
      const uploadId = await uploadLargeFile(file);
      if (file.size > DIRECT_UPLOAD_LIMIT && !uploadId) return;
      const body = new FormData();
      if (uploadId) body.set("uploadId", uploadId);
      else body.set("file", file);
      body.set("year", String(year));
      const response = await fetch("/api/admin/subject-schemes/discover", { method: "POST", headers: { "x-csrf-token": csrfFromDocument() }, body });
      const data = await parsedResponse(response);
      if (!response.ok) {
        toast.error(dict.serviceUnavailable);
        return;
      }
      const discovered = data as unknown as DiscoveryReport;
      setReport(discovered);
      setRows(discovered.proposedSchemes.map((scheme) => ({
        ...scheme,
        selected: !scheme.alreadyExists,
        nameArDraft: scheme.nameAr ?? "",
        nameFrDraft: scheme.nameFr ?? "",
        coefficientDraft: ""
      })));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function toggleSelectAll(selected: boolean) {
    setRows((current) => current.map((row) => (row.alreadyExists ? row : { ...row, selected })));
  }

  async function createSelected() {
    const selected = rows.filter((row) => row.selected && !row.alreadyExists);
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/subject-schemes/confirm", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
        body: JSON.stringify({
          year,
          schemes: selected.map((row) => ({
            series: row.series,
            subjectCode: row.subjectCode,
            nameAr: row.nameArDraft.trim() || null,
            nameFr: row.nameFrDraft.trim() || null,
            coefficient: row.coefficientDraft.trim() ? Number(row.coefficientDraft) : null,
            displayOrder: row.displayOrder
          }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return toast.error(dict.serviceUnavailable);
      const results = (data.results ?? []) as { status: string }[];
      const created = results.filter((r) => r.status === "created").length;
      const duplicate = results.filter((r) => r.status === "duplicate").length;
      const error = results.filter((r) => r.status === "error").length;
      toast.success(`${dict.schemesCreatedResult}: ${created} · ${dict.schemesDuplicateResult}: ${duplicate}${error ? ` · ${dict.schemesErrorResult}: ${error}` : ""}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const bySeries = rows.reduce<Record<string, EditableRow[]>>((acc, row) => {
    (acc[row.series] ??= []).push(row);
    return acc;
  }, {});

  return <section className="surface p-5">
    <h2 className="font-black">{dict.discoverSubjectsTitle}</h2>
    <p className="muted mt-2 text-sm">{dict.discoverSubjectsHelp}</p>

    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label><span className="label">{dict.examYear}</span><input className="field" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
      <label>
        <span className="label">{dict.file}</span>
        <input className="field" type="file" accept=".json" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>
    </div>
    <button className="button mt-4" disabled={!file || loading} onClick={analyze}>{loading ? "…" : dict.analyzeFile}</button>

    {report && <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface p-4"><b className="text-2xl">{report.totalRows}</b><p className="muted text-xs">{dict.totalRowsDiscovered}</p></div>
        <div className="surface p-4"><b className="text-2xl">{report.distinctSeries.length}</b><p className="muted text-xs">{dict.discoveredSeriesLabel}</p></div>
        <div className="surface p-4"><b className="text-2xl">{report.sharedSubjects.length}</b><p className="muted text-xs">{dict.sharedSubjectsLabel}</p></div>
        <div className="surface p-4"><b className="text-2xl">{report.uniqueSubjects.length}</b><p className="muted text-xs">{dict.uniqueSubjectsLabel}</p></div>
      </div>

      {report.malformedRowCount > 0 && <div className="surface p-4"><p className="font-bold text-[var(--danger)]">{dict.malformedRowsFound}: {report.malformedRowCount}</p></div>}

      {report.codeVariantGroups.length > 0 && <div className="surface p-4" role="status">
        <p className="font-bold">{dict.codeVariantWarningLabel}</p>
        <ul className="muted mt-1 text-sm">
          {report.codeVariantGroups.map((group) => <li key={group.normalized}>{group.variants.map((v) => `"${v.raw}" (${v.count})`).join(" ↔ ")}</li>)}
        </ul>
      </div>}

      {report.sharedSubjects.length > 0 && <div className="surface p-4">
        <p className="font-bold">{dict.sharedSubjectsLabel}</p>
        <p className="muted mt-1 text-sm">{report.sharedSubjects.map((s) => `${s.subjectCode} (${s.series.join(", ")})`).join(" · ")}</p>
      </div>}

      <div className="flex justify-end">
        <button type="button" className="button secondary" onClick={() => toggleSelectAll(true)}>{dict.selectAll}</button>
      </div>

      {Object.keys(bySeries).length === 0 && <p className="muted">{dict.noSeriesDiscovered}</p>}

      {Object.entries(bySeries).map(([series, seriesRows]) => <div key={series} className="surface overflow-x-auto p-4">
        <h3 className="font-black">{series}</h3>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="muted text-start">
            <th className="p-2 text-start"></th>
            <th className="p-2 text-start">{dict.subjectCode}</th>
            <th className="p-2 text-start">{dict.subjectNameAr}</th>
            <th className="p-2 text-start">{dict.subjectNameFr}</th>
            <th className="p-2 text-start">{dict.coefficient}</th>
            <th className="p-2 text-start">{dict.candidateCountLabel}</th>
            <th className="p-2 text-start">{dict.rowCountLabel}</th>
          </tr></thead>
          <tbody>
            {seriesRows.map((row) => {
              const index = rows.indexOf(row);
              return <tr key={`${row.series}-${row.subjectCode}`}>
                <td className="p-2"><input type="checkbox" checked={row.selected} disabled={row.alreadyExists} onChange={(event) => updateRow(index, { selected: event.target.checked })} /></td>
                <td className="p-2"><bdi className="font-bold">{row.subjectCode}</bdi>{row.alreadyExists && <span className="badge ms-2 text-xs">{dict.alreadyExistsLabel}</span>}</td>
                <td className="p-2"><input className="field" value={row.nameArDraft} disabled={row.alreadyExists} onChange={(event) => updateRow(index, { nameArDraft: event.target.value })} /></td>
                <td className="p-2"><input className="field" value={row.nameFrDraft} disabled={row.alreadyExists} onChange={(event) => updateRow(index, { nameFrDraft: event.target.value })} /></td>
                <td className="p-2">
                  <input className="field" type="number" step="0.01" placeholder={dict.coefficientPendingLabel} value={row.coefficientDraft} disabled={row.alreadyExists} onChange={(event) => updateRow(index, { coefficientDraft: event.target.value })} />
                </td>
                <td className="p-2">{row.candidateCount}</td>
                <td className="p-2">{row.rowCount}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>)}

      <button className="button" disabled={loading || rows.every((row) => !row.selected || row.alreadyExists)} onClick={createSelected}>{loading ? "…" : dict.createSelectedSchemes}</button>
    </div>}
  </section>;
}
