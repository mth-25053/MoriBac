"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";
import { DIRECT_UPLOAD_LIMIT, IMPORT_CHUNK_SIZE } from "@/lib/import-upload-config";
import type { Locale } from "@/lib/i18n";

type FlaggedRow = { row: { candidateNumber: string; series: string; subjectCode: string; mark: number } };
type SetEntry = { candidateNumber: string; series: string; missingSubjectCodes?: string[]; unexpectedSubjectCodes?: string[] };

type DryRunReport = {
  batchId: string;
  status: "VALIDATED" | "FAILED";
  checksum: string;
  totalRows: number;
  malformedRowCount: number;
  importableCount: number;
  gradedRowCount: number;
  exemptRowCount: number;
  rejectedRowCount: number;
  unmatchedCount: number;
  seriesMismatchCount: number;
  duplicateInputRowsCount: number;
  unknownSubjectCodesCount: number;
  malformedMarksCount: number;
  incompleteSubjectSets: SetEntry[];
  unexpectedSubjectSets: SetEntry[];
  unmatched: FlaggedRow[];
};

type HistoryRow = {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  validatedRows: number;
  importedRows: number;
  rejectedRows: number;
  createdAt: string;
  year: number;
  adminEmail: string;
};

type Progress = { status: string; totalRows: number; rowsImported: number };

export function GradeImportClient({ dict, locale, history }: { dict: AdminDictionary; locale: Locale; history: HistoryRow[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const uploadRef = useRef<{ file: File; uploadId: string } | null>(null);

  useEffect(() => {
    if (!loading || !report?.batchId) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/grade-import/${report.batchId}`, { headers: { "x-csrf-token": csrfFromDocument() } });
        if (response.ok) setProgress(await response.json());
      } catch {
        // A failed progress poll must never interrupt the actual import request in flight.
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, report?.batchId]);

  async function parsedResponse(response: Response) {
    const text = await response.text();
    if (!text) return {} as Record<string, unknown>;
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { error: response.status === 413 ? "FUNCTION_PAYLOAD_TOO_LARGE" : "INVALID_SERVER_RESPONSE" };
    }
  }

  async function uploadLargeFile() {
    if (!file || file.size <= DIRECT_UPLOAD_LIMIT) return null;
    if (uploadRef.current?.file === file) return uploadRef.current.uploadId;
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / IMPORT_CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const chunk = file.slice(chunkIndex * IMPORT_CHUNK_SIZE, Math.min(file.size, (chunkIndex + 1) * IMPORT_CHUNK_SIZE));
      let uploaded = false;
      let lastData: Record<string, unknown> = {};
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const body = new FormData();
        body.set("uploadId", uploadId);
        body.set("fileName", file.name);
        body.set("mimeType", file.type || "application/json");
        body.set("fileSize", String(file.size));
        body.set("totalChunks", String(totalChunks));
        body.set("chunkIndex", String(chunkIndex));
        body.set("chunk", chunk, file.name + ".part");
        try {
          const response = await fetch("/api/admin/grade-import/upload", {
            method: "POST",
            headers: { "x-csrf-token": csrfFromDocument() },
            body
          });
          lastData = await parsedResponse(response);
          if (response.ok) {
            uploaded = true;
            break;
          }
          if (response.status < 500 && response.status !== 429) break;
        } catch {
          lastData = { error: "SERVICE_UNAVAILABLE" };
        }
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
      }
      if (!uploaded) {
        toast.error(translatedApiError(typeof lastData.error === "string" ? lastData.error : "UPLOAD_FAILED", dict, locale));
        return null;
      }
    }

    uploadRef.current = { file, uploadId };
    return uploadId;
  }

  async function request(path: string) {
    if (!file) return null;
    setLoading(true);
    try {
      const uploadId = await uploadLargeFile();
      if (file.size > DIRECT_UPLOAD_LIMIT && !uploadId) return null;
      const body = new FormData();
      if (uploadId) body.set("uploadId", uploadId);
      else body.set("file", file);
      body.set("year", String(year));
      if (report) body.set("checksum", report.checksum);
      const response = await fetch(path, { method: "POST", headers: { "x-csrf-token": csrfFromDocument() }, body });
      const data = await parsedResponse(response);
      if (!response.ok) {
        toast.error(translatedApiError(typeof data.error === "string" ? data.error : "INVALID_SERVER_RESPONSE", dict, locale));
        return null;
      }
      return data;
    } catch {
      toast.error(dict.serviceUnavailable);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function dryRun() {
    const data = await request("/api/admin/grade-import/dry-run");
    if (data) setReport(data as DryRunReport);
  }

  async function commit() {
    setProgress(null);
    const data = await request("/api/admin/grade-import/commit");
    if (data) {
      toast.success(`${dict.imported}: ${data.imported}`);
      setReport(null);
      setFile(null);
      uploadRef.current = null;
    }
  }

  async function resume(batchId: string) {
    const response = await fetch(`/api/admin/grade-import/${batchId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
      body: JSON.stringify({ action: "complete" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.error === "ALREADY_IMPORTED" ? dict.alreadyImported : dict.cannotResumeBatch);
    toast.success(`${dict.completeImportSuccess}: ${data.imported}`);
    window.location.reload();
  }

  async function rollback(batchId: string) {
    if (!confirm(dict.confirmRollbackGradeImport)) return;
    const response = await fetch(`/api/admin/grade-import/${batchId}`, { method: "DELETE", headers: { "x-csrf-token": csrfFromDocument() } });
    if (!response.ok) return toast.error(dict.serviceUnavailable);
    toast.success(dict.rollbackSuccess);
    window.location.reload();
  }

  async function downloadReport(batchId: string, format: "json" | "csv") {
    const response = await fetch(`/api/admin/grade-import/${batchId}/report?format=${format}`, { headers: { "x-csrf-token": csrfFromDocument() } });
    if (!response.ok) return toast.error(dict.serviceUnavailable);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `grade-import-${batchId}-report.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <div>
    <span className="eyebrow">{dict.gradeImportNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.gradeImportTitle}</h1>
    <p className="muted mt-3 max-w-2xl">{dict.gradeImportHelp}</p>

    <section className="surface mt-7 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">{dict.examYear}</span><input className="field" type="number" min="2000" max="2100" value={year} onChange={(event) => { setYear(Number(event.target.value)); setReport(null); }} /></label>
        <label>
          <span className="label">{dict.file}</span>
          <input
            className="field file:me-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1 file:font-bold"
            type="file"
            accept=".json"
            onChange={(event) => { uploadRef.current = null; setFile(event.target.files?.[0] || null); setReport(null); }}
          />
        </label>
      </div>
      <button className="button mt-5" disabled={!file || loading} onClick={dryRun}>{loading ? "…" : dict.dryRun}</button>
    </section>

    {report && <section className="mt-7 space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {([[dict.totalRows, report.totalRows], [dict.importableCount, report.importableCount], [dict.rejectedRows, report.totalRows - report.importableCount]] as const).map(([label, value]) => (
          <div className="surface p-4" key={label}><b className="text-2xl">{value}</b><p className="muted text-xs">{label}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([[dict.gradedRowsLabel, report.gradedRowCount], [dict.exemptRowsLabel, report.exemptRowCount]] as const).map(([label, value]) => (
          <div className="surface p-4" key={label}><b className="text-2xl">{value}</b><p className="muted text-xs">{label}</p></div>
        ))}
      </div>

      <ReportCategory label={dict.malformedRows} count={report.malformedRowCount} />
      <ReportCategory label={dict.unmatchedCandidates} count={report.unmatchedCount} />
      <ReportCategory label={dict.seriesMismatchLabel} count={report.seriesMismatchCount} />
      <ReportCategory label={dict.duplicateInputRowsLabel} count={report.duplicateInputRowsCount} />
      <ReportCategory label={dict.unknownSubjectCodesLabel} count={report.unknownSubjectCodesCount} critical />
      <ReportCategory label={dict.malformedMarksLabel} count={report.malformedMarksCount} />

      {report.incompleteSubjectSets.length > 0 && <div className="surface p-4" role="status">
        <p className="font-bold">{dict.incompleteSubjectSetsLabel}</p>
        <p className="muted mt-1 text-sm">{report.incompleteSubjectSets.slice(0, 20).map((entry) => `${entry.candidateNumber} (${entry.missingSubjectCodes?.join(", ")})`).join(" · ")}</p>
      </div>}
      {report.unexpectedSubjectSets.length > 0 && <div className="surface p-4" role="status">
        <p className="font-bold">{dict.unexpectedSubjectSetsLabel}</p>
        <p className="muted mt-1 text-sm">{report.unexpectedSubjectSets.slice(0, 20).map((entry) => `${entry.candidateNumber} (${entry.unexpectedSubjectCodes?.join(", ")})`).join(" · ")}</p>
      </div>}
      {report.unknownSubjectCodesCount > 0 && <div className="surface p-4"><p className="font-bold text-[var(--danger)]">{dict.unknownCodesBlockImport}</p></div>}

      <div className="flex flex-wrap gap-2">
        <button className="button secondary" onClick={() => downloadReport(report.batchId, "json")}>{dict.downloadJson}</button>
        <button className="button secondary" onClick={() => downloadReport(report.batchId, "csv")}>{dict.downloadCsv}</button>
      </div>

      <button className="button" disabled={report.status !== "VALIDATED" || loading} onClick={commit}>{loading ? "…" : dict.commit}</button>
      {loading && progress && <div className="surface p-4">
        <div className="flex items-center justify-between text-sm font-bold"><span>{dict.importProgress}</span><span className="tabular-nums">{progress.rowsImported}/{progress.totalRows}</span></div>
        <div className="mt-2 h-2 rounded-full bg-[var(--surface-2)]"><div className="h-2 rounded-full transition-all" style={{ width: `${progress.totalRows ? Math.min(100, (progress.rowsImported / progress.totalRows) * 100) : 0}%`, background: "var(--accent)" }} /></div>
      </div>}
    </section>}

    <section className="surface mt-7 overflow-hidden">
      <h2 className="p-5 font-black">{dict.gradeImportHistoryNav}</h2>
      {history.length === 0
        ? <p className="muted p-8 text-center">{dict.noImports}</p>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]"><tr>{[dict.fileName, dict.examYear, dict.status, dict.validRows, dict.date, ""].map((heading, index) => <th className="p-4 text-start" key={`${heading}-${index}`}>{heading}</th>)}</tr></thead>
            <tbody>{history.map((batch) => <tr className="border-t" style={{ borderColor: "var(--line)" }} key={batch.id}>
              <td className="p-4"><b>{batch.fileName}</b><div className="muted text-xs">{batch.adminEmail}</div></td>
              <td className="p-4">{batch.year}</td>
              <td className="p-4"><span className={`badge ${batch.status === "FAILED" ? "fail" : ""}`}>{statusLabel(batch.status, dict)}</span></td>
              <td className="p-4">{batch.importedRows}/{batch.validatedRows}{batch.rejectedRows ? ` · ${batch.rejectedRows} ${dict.rejectedRows}` : ""}</td>
              <td className="p-4" dir="ltr">{new Date(batch.createdAt).toLocaleString()}</td>
              <td className="p-4"><div className="flex flex-wrap gap-2">
                {(batch.status === "VALIDATED" || batch.status === "IMPORTING") && <button className="button secondary !min-h-10" onClick={() => resume(batch.id)}>{dict.completeImport}</button>}
                {batch.status !== "ROLLED_BACK" && <button className="button secondary !min-h-10 !text-[var(--danger)]" onClick={() => rollback(batch.id)}>{dict.rollbackAction}</button>}
                <button className="button secondary !min-h-10" onClick={() => downloadReport(batch.id, "json")}>{dict.downloadJson}</button>
                <button className="button secondary !min-h-10" onClick={() => downloadReport(batch.id, "csv")}>{dict.downloadCsv}</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </div>;
}

function ReportCategory({ label, count, critical }: { label: string; count: number; critical?: boolean }) {
  if (!count) return null;
  return <div className="surface p-4" role="status"><p className={`font-bold ${critical ? "text-[var(--danger)]" : ""}`}>{label}: {count}</p></div>;
}

function statusLabel(status: string, dict: AdminDictionary) {
  if (status === "IMPORTED") return dict.imported;
  if (status === "FAILED") return dict.statusFailed;
  if (status === "IMPORTING") return dict.importingLabel;
  if (status === "ROLLED_BACK") return dict.rolledBackLabel;
  return dict.statusValidated;
}

function translatedApiError(code: string, dict: AdminDictionary, locale: Locale) {
  const messages: Record<string, string> = {
    INVALID_FILE_TYPE: dict.invalidGradeFile,
    FILE_SIZE: dict.invalidGradeFile,
    SOURCE_TYPE_NOT_IMPLEMENTED: dict.sourceNotImplemented,
    INVALID_JSON_FILE: dict.invalidGradeFile,
    FUNCTION_PAYLOAD_TOO_LARGE: locale === "ar" ? "حجم الملف يتجاوز حد الرفع المباشر. أعد المحاولة." : "Le fichier dépasse la limite directe. Réessayez.",
    UPLOAD_FAILED: dict.serviceUnavailable,
    INVALID_SERVER_RESPONSE: dict.serviceUnavailable,
    DUPLICATE_FILE: dict.duplicateFile,
    FILE_CHANGED_AFTER_PREVIEW: dict.fileChanged,
    UNKNOWN_SUBJECT_CODES: dict.unknownCodesBlockImport,
    IMPORT_TRANSACTION_FAILED: dict.importFailed,
    SERVICE_UNAVAILABLE: dict.serviceUnavailable,
    DRY_RUN_REQUIRED: dict.dryRunRequiredError,
    ALREADY_IMPORTED: dict.alreadyImported,
    STALE_SUBJECT_SCHEME: dict.staleSubjectSchemeError,
    STALE_CANDIDATE_DATASET: dict.staleCandidateDatasetError,
    IMPORT_ALREADY_IN_PROGRESS: dict.importAlreadyInProgressError,
    DATABASE_CONNECTION_FAILED: locale === "ar" ? "تعذر الاتصال بقاعدة البيانات بعد ثلاث محاولات." : "Connexion à la base impossible après trois tentatives.",
    DATABASE_SCHEMA_ERROR: locale === "ar" ? "مخطط قاعدة البيانات غير جاهز." : "Le schéma de la base n’est pas prêt."
  };
  return messages[code] || dict.importFailed;
}
