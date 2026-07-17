"use client";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ locale, label }: { locale: "ar"|"fr"; label: string }) {
  function toggle() {
    document.cookie = `moribac_language=${locale === "ar" ? "fr" : "ar"};path=/;max-age=31536000;samesite=lax`;
    location.reload();
  }
  return <button type="button" className="button secondary !min-h-11" onClick={toggle} aria-label={label}><Languages size={18}/><span>{label}</span></button>;
}
