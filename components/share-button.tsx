"use client";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Dictionary, Locale } from "@/lib/i18n";
import { renderShareCard } from "@/lib/share-card";

export function ShareButton({
  dict,
  locale,
  fullName,
  candidateNumber,
  series,
  wilaya,
  average,
  decisionLabel,
  year,
  badgeLabel
}: {
  dict: Dictionary;
  locale: Locale;
  fullName: string;
  candidateNumber: string;
  series: string;
  wilaya: string | null;
  average: number;
  decisionLabel: string;
  year: number;
  badgeLabel?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderShareCard(
        { fullName, candidateNumber, series, wilaya, average, decisionLabel, year, badgeLabel },
        locale,
        dict.brand,
        { series: dict.series, wilaya: dict.wilaya, average: dict.average, year: dict.publishedYear }
      );
      const fileName = `mthbac-${candidateNumber}.png`;
      const shareUrl = `${window.location.origin}/?number=${encodeURIComponent(candidateNumber)}&year=${year}`;
      const shareText = `${dict.brand} — ${fullName} — ${decisionLabel}`;

      const file = new File([blob], fileName, { type: "image/png" });
      const filesPayload = { files: [file], title: dict.brand, text: shareText };
      if (typeof navigator.canShare === "function" && navigator.canShare(filesPayload) && navigator.share) {
        await navigator.share(filesPayload);
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: dict.brand, text: shareText, url: shareUrl });
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
      toast.success(dict.shareDownloaded);
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      toast.error(dict.shareFailed);
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" className="button secondary" disabled={busy} onClick={handleShare} aria-label={dict.shareResult}>
    <Share2 size={17} /> {busy ? dict.shareCardGenerating : dict.share}
  </button>;
}
