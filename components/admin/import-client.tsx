"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MappingWizard, canonicalFieldLabel } from "@/components/admin/mapping-wizard";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";
import { DIRECT_UPLOAD_LIMIT, IMPORT_CHUNK_SIZE } from "@/lib/import-upload-config";
import { canonicalFields, type CanonicalField, type ColumnMapping, type DecisionSample, type DetectedColumn, type DuplicateNumber, type NewSeries, type UnknownDecision } from "@/lib/excel/types";
import type { Locale } from "@/lib/i18n";

type Report = {
  mappingRequired: false;
  checksum: string;
  mapping: ColumnMapping;
  mappingSource: "automatic" | "saved" | "manual";
  sheetName: string;
  sheetsScanned: number;
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: Record<string, unknown>[];
  errors: { rowNumber: number; field?: string; message: string }[];
  newSeries: NewSeries[];
  unknownDecisions: UnknownDecision[];
  duplicateNumbers: DuplicateNumber[];
  decisionSummary: DecisionSample[];
};

type MappingRequest = {
  mappingRequired: true;
  structureKey: string;
  sheetName: string;
  headerRow: number;
  columns: DetectedColumn[];
  mapping: ColumnMapping;
  missingRequired: CanonicalField[];
};

type Progress = { status: "VALIDATED" | "IMPORTED" | "FAILED"; totalRows: number; rowsImported: number };

export function ImportClient({ dict, locale }: { dict: AdminDictionary; locale: Locale }) {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [session, setSession] = useState<"NORMAL" | "COMPLEMENTAIRE">("NORMAL");
  const [report, setReport] = useState<Report | null>(null);
  const [mappingRequest, setMappingRequest] = useState<MappingRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const uploadRef = useRef<{ file: File; uploadId: string } | null>(null);

  function resetResult() {
    setReport(null);
    setMappingRequest(null);
    setProgress(null);
  }

  useEffect(() => {
    if (!loading || !report?.batchId) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/import/${report.batchId}`, { headers: { "x-csrf-token": csrfFromDocument() } });
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
      return {
        error: response.status === 413 ? "FUNCTION_PAYLOAD_TOO_LARGE" : "INVALID_SERVER_RESPONSE"
      };
    }
  }

  function responseRequestId(data: Record<string, unknown>) {
    if (typeof data.requestId === "string") return data.requestId;
    const details = data.details;
    return details && typeof details === "object" && "requestId" in details && typeof details.requestId === "string"
      ? details.requestId
      : null;
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
      const chunkRequestId = crypto.randomUUID();
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const body = new FormData();
        body.set("uploadId", uploadId);
        body.set("fileName", file.name);
        body.set("mimeType", file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        body.set("fileSize", String(file.size));
        body.set("totalChunks", String(totalChunks));
        body.set("chunkIndex", String(chunkIndex));
        body.set("chunk", chunk, file.name + ".part");
        try {
          const response = await fetch("/api/admin/import/upload", {
            method: "POST",
            headers: {
              "x-csrf-token": csrfFromDocument(),
              "x-request-id": chunkRequestId
            },
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
        const code = typeof lastData.error === "string" ? lastData.error : "UPLOAD_FAILED";
        const message = translatedApiError(code, dict, locale);
        const errorRequestId = responseRequestId(lastData);
        const suffix = errorRequestId ? " (" + errorRequestId + ")" : "";
        toast.error(message + suffix);
        return null;
      }
    }

    uploadRef.current = { file, uploadId };
    return uploadId;
  }

  async function request(path: string, mappingOverride?: ColumnMapping) {
    if (!file) return null;
    setLoading(true);
    try {
      const uploadId = await uploadLargeFile();
      if (file.size > DIRECT_UPLOAD_LIMIT && !uploadId) return null;
      const body = new FormData();
      if (uploadId) body.set("uploadId", uploadId);
      else body.set("file", file);
      body.set("year", String(year));
      body.set("session", session);
      const mapping = mappingOverride ?? report?.mapping;
      if (mapping) body.set("mapping", JSON.stringify(mapping));
      if (report) body.set("checksum", report.checksum);
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "x-csrf-token": csrfFromDocument(),
          "x-request-id": crypto.randomUUID()
        },
        body
      });
      const data = await parsedResponse(response);
      if (!response.ok) {
        const code = typeof data.error === "string" ? data.error : "INVALID_SERVER_RESPONSE";
        const errorRequestId = responseRequestId(data);
        const suffix = errorRequestId ? " (" + errorRequestId + ")" : "";
        toast.error(translatedApiError(code, dict, locale) + suffix);
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
  async function preview(mapping?: ColumnMapping) {
    const data = await request("/api/admin/import/preview", mapping);
    if (!data) return;
    if (data.mappingRequired) {
      setReport(null);
      setMappingRequest(data as MappingRequest);
    } else {
      setMappingRequest(null);
      setReport(data as Report);
    }
  }

  async function commit() {
    setProgress(null);
    const data = await request("/api/admin/import/commit");
    if (data) {
      toast.success(`${dict.imported}: ${data.imported}`);
      setReport(null);
      setMappingRequest(null);
      setProgress(null);
      setFile(null);
      uploadRef.current = null;
    }
  }

  return <div>
    <span className="eyebrow">{dict.import}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.uploadTitle}</h1>
    <p className="muted mt-3 max-w-2xl">{dict.uploadHelp}</p>
    <section className="surface mt-7 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">{dict.examYear}</span><input className="field" type="number" min="2000" max="2100" value={year} onChange={(event) => { setYear(Number(event.target.value)); resetResult(); }} /></label>
        <label><span className="label">{dict.file}</span><input className="field file:me-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1 file:font-bold" type="file" accept=".xlsx" onChange={(event) => { uploadRef.current = null; setFile(event.target.files?.[0] || null); resetResult(); }} /></label>
      </div>
      <div className="mt-4">
        <span className="label">{dict.examSession}</span>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-label={dict.examSession}>
          {(["NORMAL", "COMPLEMENTAIRE"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={session === option}
              onClick={() => { setSession(option); resetResult(); }}
              className="rounded-lg border px-4 py-2 text-sm font-bold transition-colors"
              style={session === option
                ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }
                : { borderColor: "var(--line)" }}
            >
              {option === "NORMAL" ? dict.examSessionNormal : dict.examSessionComplementaire}
            </button>
          ))}
        </div>
        {session === "COMPLEMENTAIRE" && <p className="muted mt-2 text-xs">{dict.examSessionComplementaire} — {year}</p>}
      </div>
      <button className="button mt-5" disabled={!file || loading} onClick={() => preview()}>{loading ? "…" : dict.validate}</button>
    </section>

    {mappingRequest && <MappingWizard
      key={mappingRequest.structureKey}
      locale={locale}
      columns={mappingRequest.columns}
      initialMapping={mappingRequest.mapping}
      sheetName={mappingRequest.sheetName}
      headerRow={mappingRequest.headerRow}
      loading={loading}
      onConfirm={preview}
    />}

    {report && <section className="mt-7 space-y-5">
      <p className="muted text-xs">{locale === "ar" ? `الورقة: ${report.sheetName} (من أصل ${report.sheetsScanned} ورقة تم فحصها)` : `Feuille : ${report.sheetName} (${report.sheetsScanned} feuille(s) analysée(s))`}</p>
      <div className="grid grid-cols-3 gap-3">{[[dict.totalRows, report.totalRows], [dict.validRows, report.validRows], [dict.invalidRows, report.invalidRows]].map(([label, value]) => <div className="surface p-4" key={label}><b className="text-2xl">{value}</b><p className="muted text-xs">{label}</p></div>)}</div>
      {report.newSeries.length > 0 && <div className="surface p-4" role="status"><p className="font-bold">{dict.newSeriesDetected}</p><p className="muted mt-1 text-sm">{report.newSeries.map((entry) => `${entry.series} (${entry.count})`).join(" · ")}</p></div>}
      {report.unknownDecisions.length > 0 && <div className="surface p-4" role="status"><p className="font-bold">{dict.unknownDecisionsDetected}</p><p className="muted mt-1 text-sm">{report.unknownDecisions.map((entry) => `${entry.rawValue} (${entry.count})`).join(" · ")}</p></div>}
      {report.duplicateNumbers.length > 0 && <div className="surface p-4" role="status"><p className="font-bold text-[var(--danger)]">{dict.duplicateNumber}</p><p className="muted mt-1 text-sm">{report.duplicateNumbers.map((entry) => `${entry.candidateNumber} (${entry.count})`).join(" · ")}</p></div>}
      {report.decisionSummary.length > 0 && <div className="surface p-4"><p className="font-bold">{dict.decision}</p><p className="muted mt-1 text-sm">{report.decisionSummary.map((entry) => `${entry.value} (${entry.count})`).join(" · ")}</p></div>}
      {report.errors.length > 0 && <div className="surface p-5"><h2 className="font-black text-[var(--danger)]">{dict.errors}</h2><ul className="mt-3 max-h-64 overflow-auto text-sm">{report.errors.slice(0, 100).map((error, index) => <li className="border-b py-2" style={{ borderColor: "var(--line)" }} key={index}>#{error.rowNumber} · {error.field ? previewLabel(error.field, dict, locale) : ""}: {translatedError(error.message, dict)}</li>)}</ul></div>}
      <div className="surface overflow-hidden"><h2 className="p-5 font-black">{dict.preview}</h2><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[var(--surface-2)]"><tr>{canonicalFields.map((field) => <th className="whitespace-nowrap p-3 text-start" key={field.key}>{previewLabel(field.key, dict, locale)}</th>)}</tr></thead><tbody>{report.preview.map((row, index) => <tr className="border-t" style={{ borderColor: "var(--line)" }} key={index}>{canonicalFields.map((field) => <td className="whitespace-nowrap p-3" key={field.key}>{previewValue(field.key, row[field.key], dict)}</td>)}</tr>)}</tbody></table></div></div>
      <button className="button" disabled={report.invalidRows > 0 || loading} onClick={commit}>{loading ? "…" : dict.commit}</button>
      {loading && progress && <div className="surface p-4">
        <div className="flex items-center justify-between text-sm font-bold"><span>{dict.importProgress}</span><span className="tabular-nums">{progress.rowsImported}/{progress.totalRows}</span></div>
        <div className="mt-2 h-2 rounded-full bg-[var(--surface-2)]"><div className="h-2 rounded-full transition-all" style={{ width: `${progress.totalRows ? Math.min(100, (progress.rowsImported / progress.totalRows) * 100) : 0}%`, background: "var(--accent)" }} /></div>
      </div>}
    </section>}
  </div>;
}

function translatedError(message: string, dict: AdminDictionary) {
  const messages: Record<string, string> = { "Missing required value": dict.missingValue, "Average must be between 0 and 20": dict.invalidAverage, "Unknown decision": dict.unknownDecision, "Duplicate candidate number in file": dict.duplicateNumber };
  return messages[message] || message;
}

function translatedApiError(code: string, dict: AdminDictionary, locale: Locale) {
  const messages: Record<string, string> = { INVALID_FILE_TYPE: dict.invalidFile, INVALID_XLSX_SIGNATURE: dict.invalidFile, INVALID_EXCEL_FILE: dict.invalidFile, FILE_SIZE: dict.invalidFile, FUNCTION_PAYLOAD_TOO_LARGE: locale === "ar" ? "حجم الملف يتجاوز حد الرفع المباشر. اعد المحاولة باستخدام الرفع الامن." : "Le fichier depasse la limite directe. Reessayez avec envoi securise.", UPLOAD_FAILED: dict.serviceUnavailable, INVALID_SERVER_RESPONSE: dict.serviceUnavailable, DUPLICATE_FILE: dict.duplicateFile, FILE_CHANGED_AFTER_PREVIEW: dict.fileChanged, IMPORT_TRANSACTION_FAILED: dict.importFailed, SERVICE_UNAVAILABLE: dict.serviceUnavailable, DATABASE_CONNECTION_FAILED: locale === "ar" ? "تعذر الاتصال بقاعدة البيانات بعد ثلاث محاولات. أعد المحاولة بعد لحظات." : "Connexion à la base impossible après trois tentatives. Réessayez dans quelques instants.", DATABASE_SCHEMA_ERROR: locale === "ar" ? "مخطط قاعدة البيانات غير جاهز. تحقق من الترحيلات." : "Le schéma de la base n’est pas prêt. Vérifiez les migrations.", INVALID_COLUMN_MAPPING: locale === "ar" ? "مطابقة الأعمدة غير صالحة" : "La correspondance des colonnes est invalide", MAPPING_REQUIRED: locale === "ar" ? "يجب إكمال مطابقة الأعمدة" : "La correspondance des colonnes doit être complétée", NO_SHEETS_FOUND: locale === "ar" ? "لا يحتوي الملف على أي ورقة عمل." : "Le fichier ne contient aucune feuille de calcul.", NO_HEADER_ROW_DETECTED: locale === "ar" ? "تعذر العثور على صف عناوين في أي من أوراق الملف." : "Aucune ligne d’en-têtes n’a été détectée dans les feuilles du fichier." };
  return messages[code] || dict.importFailed;
}

function previewLabel(key: string, dict: AdminDictionary, locale: Locale) {
  const labels: Record<string, string> = { candidateNumber: dict.candidateNumber, fullName: dict.fullName, series: dict.series, average: dict.average, decision: dict.decision, wilaya: dict.wilaya, examCenter: dict.center, school: dict.school };
  return labels[key] || canonicalFieldLabel(key as CanonicalField, locale);
}

function previewValue(key: string, value: unknown, dict: AdminDictionary) {
  if (key === "decision" && typeof value === "string" && value in dict.decisions) return dict.decisions[value as keyof typeof dict.decisions];
  if (key === "average" && typeof value === "number") return value.toFixed(2);
  return value == null || value === "" ? "—" : String(value);
}