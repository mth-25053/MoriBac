"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Dictionary, Locale } from "@/lib/i18n";

export function DownloadResultPdfButton({ dict, locale, candidateNumber, year }: { dict: Dictionary; locale: Locale; candidateNumber: string; year: number }) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      const query = new URLSearchParams({ number: candidateNumber, year: String(year), locale });
      const response = await fetch(`/api/public/candidate-result-pdf?${query.toString()}`);
      if (!response.ok) throw new Error("PDF_REQUEST_FAILED");
      const blob = await response.blob();
      const fileName = `mthbac-${year}-${candidateNumber}.pdf`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
      toast.success(dict.pdfDownloaded);
    } catch {
      toast.error(dict.pdfFailed);
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" className="button secondary" disabled={busy} onClick={handleDownload} aria-label={dict.downloadResultPdf}>
    <FileDown size={17} /> {busy ? dict.pdfGenerating : dict.downloadResultPdf}
  </button>;
}
