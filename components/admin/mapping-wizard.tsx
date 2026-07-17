"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { canonicalFields, requiredFields, type CanonicalField, type ColumnMapping, type DetectedColumn } from "@/lib/excel/types";

const labels: Record<Locale, Record<CanonicalField, string>> = {
  ar: {
    candidateNumber: "رقم المترشح",
    fullName: "الاسم الكامل",
    series: "الشعبة",
    average: "المعدل",
    decision: "القرار",
    wilaya: "الولاية",
    examCenter: "مركز الامتحان",
    school: "المؤسسة",
    birthDate: "تاريخ الميلاد",
    birthPlace: "مكان الميلاد",
    candidateType: "نوع المترشح"
  },
  fr: {
    candidateNumber: "Numéro du candidat",
    fullName: "Nom complet",
    series: "Série",
    average: "Moyenne",
    decision: "Décision",
    wilaya: "Wilaya",
    examCenter: "Centre d’examen",
    school: "Établissement",
    birthDate: "Date de naissance",
    birthPlace: "Lieu de naissance",
    candidateType: "Type de candidat"
  }
};

const copy = {
  ar: {
    eyebrow: "مطابقة الأعمدة",
    title: "حدد أعمدة ملف Excel",
    help: "تعذر التعرف على بعض الحقول تلقائياً. اربط حقول التطبيق بأعمدة الملف، ثم تابع المعاينة.",
    actual: "الأعمدة المكتشفة",
    canonical: "حقول التطبيق",
    select: "اختر عموداً",
    required: "إلزامي",
    optional: "اختياري",
    confirm: "تأكيد المطابقة والمعاينة",
    sheet: "ورقة",
    headerRow: "صف العناوين"
  },
  fr: {
    eyebrow: "Correspondance des colonnes",
    title: "Associer les colonnes Excel",
    help: "Certains champs n’ont pas été identifiés automatiquement. Associez les champs de l’application aux colonnes du fichier, puis continuez l’aperçu.",
    actual: "Colonnes détectées",
    canonical: "Champs de l’application",
    select: "Sélectionner une colonne",
    required: "Obligatoire",
    optional: "Facultatif",
    confirm: "Confirmer et prévisualiser",
    sheet: "Feuille",
    headerRow: "Ligne d’en-tête"
  }
} satisfies Record<Locale, Record<string, string>>;

export function canonicalFieldLabel(field: CanonicalField, locale: Locale) {
  return labels[locale][field];
}

export function MappingWizard({
  locale,
  columns,
  initialMapping,
  sheetName,
  headerRow,
  loading,
  onConfirm
}: {
  locale: Locale;
  columns: DetectedColumn[];
  initialMapping: ColumnMapping;
  sheetName: string;
  headerRow: number;
  loading: boolean;
  onConfirm: (mapping: ColumnMapping) => void;
}) {
  const text = copy[locale];
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  const complete = requiredFields.every((field) => mapping[field]);

  function select(field: CanonicalField, raw: string) {
    const column = raw ? Number(raw) : undefined;
    setMapping((current) => {
      const next = { ...current };
      for (const key of canonicalFields.map((item) => item.key)) {
        if (key !== field && column && next[key] === column) delete next[key];
      }
      if (column) next[field] = column;
      else delete next[field];
      return next;
    });
  }

  return <section className="surface mt-7 overflow-hidden" aria-labelledby="mapping-title">
    <div className="border-b p-5 md:p-7" style={{ borderColor: "var(--line)" }}>
      <span className="eyebrow">{text.eyebrow}</span>
      <h2 id="mapping-title" className="mt-2 text-2xl font-black">{text.title}</h2>
      <p className="muted mt-2 max-w-3xl">{text.help}</p>
      <p className="muted mt-3 text-xs">{text.sheet}: <b>{sheetName}</b> · {text.headerRow}: <b>{headerRow}</b></p>
    </div>
    <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
      <div className="border-b p-5 lg:border-b-0 lg:border-e" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-black">{text.actual}</h3>
        <ol className="mt-4 space-y-2">
          {columns.map((column) => <li key={column.index} className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
            <span className="me-2 font-mono text-xs text-[var(--muted)]">{column.index}</span>{column.header}
          </li>)}
        </ol>
      </div>
      <div className="p-5">
        <h3 className="font-black">{text.canonical}</h3>
        <div className="mt-4 grid gap-3">
          {canonicalFields.map((field) => <label key={field.key} className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)]" style={{ borderColor: "var(--line)" }}>
            <span className="text-sm font-bold">{canonicalFieldLabel(field.key, locale)} <small className="ms-1 font-medium text-[var(--muted)]">({field.required ? text.required : text.optional})</small></span>
            <select className="field" value={mapping[field.key] ?? ""} onChange={(event) => select(field.key, event.target.value)} required={field.required}>
              <option value="">{text.select}</option>
              {columns.map((column) => <option key={column.index} value={column.index}>{column.header}</option>)}
            </select>
          </label>)}
        </div>
        <button className="button mt-5" disabled={!complete || loading} onClick={() => onConfirm(mapping)}>{loading ? "…" : text.confirm}</button>
      </div>
    </div>
  </section>;
}