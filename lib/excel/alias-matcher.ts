import type { CanonicalField, ColumnMapping, DetectedColumn } from "@/lib/excel/types";
import { canonicalFields } from "@/lib/excel/types";
import { normalizeHeader } from "@/lib/excel/header-normalizer";

const aliases: Record<CanonicalField, string[]> = {
  candidateNumber: [
    "CANDIDATE NUMBER", "CANDIDATE NO", "CANDIDATE ID", "ROLL NUMBER", "ROLL NO", "REGISTRATION NUMBER", "MATRICULE",
    "NUMBAC", "NUM BAC", "N BAC", "NUMERO BAC", "NUMERO CANDIDAT", "NUMERO DU CANDIDAT", "N° CANDIDAT", "NO CANDIDAT",
    "CODE CANDIDAT", "IDENTIFIANT CANDIDAT", "رقم المترشح", "رقم الترشح", "رقم التسجيل", "رمز المترشح"
  ],
  fullName: [
    "FULL NAME", "CANDIDATE NAME", "CANDIDATE FULL NAME", "NAME", "NOM", "NOM COMPLET", "NOM ET PRENOM", "NOM PRENOM",
    "NOM DU CANDIDAT", "NOM ET PRENOMS", "PRENOM ET NOM", "الاسم الكامل", "الإسم الكامل", "اسم المترشح"
  ],
  series: ["SERIES", "SERIE", "STREAM", "SECTION", "BRANCH", "FILIERE", "TYPE SERIE", "SPECIALITE", "الشعبة", "شعبة المترشح"],
  average: [
    "AVERAGE", "FINAL AVERAGE", "AVERAGE SCORE", "SCORE", "MARK", "MOYENNE", "MOY BAC", "MOYBAC", "MOYENNE BAC",
    "MOYENNE GENERALE", "MOYENNE FINALE", "NOTE FINALE", "المعدل", "المعدل العام", "معدل الباكالوريا"
  ],
  decision: ["DECISION", "RESULT", "RESULTAT", "DECISION FINALE", "RESULTAT FINAL", "STATUS", "OUTCOME", "VERDICT", "MENTION", "القرار", "النتيجة", "نتيجة الامتحان"],
  wilaya: ["WILAYA", "REGION", "STATE", "PROVINCE", "GOVERNORATE", "الولاية", "ولاية", "الجهة"],
  examCenter: [
    "EXAM CENTER", "EXAMINATION CENTER", "CENTER", "CENTRE", "CENTRE EXAMEN", "CENTRE D EXAMEN", "CENTREEXAMEN",
    "LIEU EXAMEN", "مركز الامتحان", "مركز الاختبار"
  ],
  school: [
    "SCHOOL", "ESTABLISHMENT", "ETABLISSEMENT", "ETABLISSEMENT ORIGINE", "ECOLE", "ECOLE ORIGINE", "LYCEE",
    "INSTITUTION", "ORIGIN SCHOOL", "المؤسسة", "المدرسة", "المؤسسة الأصلية"
  ],
  birthDate: ["BIRTH DATE", "DATE OF BIRTH", "DOB", "DATE NAISSANCE", "DATE DE NAISSANCE", "DATE NAISS", "تاريخ الميلاد", "تاريخ الازدياد"],
  birthPlace: ["BIRTH PLACE", "PLACE OF BIRTH", "LIEU NAISSANCE", "LIEU DE NAISSANCE", "LIEU NAISS", "مكان الميلاد", "محل الميلاد"],
  candidateType: [
    "CANDIDATE TYPE", "TYPE CANDIDATE", "TYPE CANDIDAT", "TYPECANDIDAT", "CANDIDATURE TYPE", "NATURE CANDIDAT",
    "STATUT CANDIDAT", "CATEGORY", "CATEGORIE", "نوع المترشح", "صفة المترشح"
  ]
};

const normalizedAliases = Object.fromEntries(
  Object.entries(aliases).map(([field, values]) => [field, values.map(normalizeHeader)])
) as Record<CanonicalField, string[]>;

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const longest = Math.max(left.length, right.length);
  const editScore = 1 - levenshtein(left, right) / longest;
  const containment = Math.min(left.length, right.length) >= 5 && (left.includes(right) || right.includes(left)) ? 0.88 : 0;
  return Math.max(editScore, containment);
}

function headerVariants(header: string) {
  const variants = new Set([header]);
  // Export systems commonly append a language marker to otherwise canonical
  // labels (for example NOM_FR or WILAYA_AR). Compare the base label too.
  const withoutLanguage = header.replace(/(?:FR|AR|EN)$/, "");
  if (withoutLanguage.length >= 3) variants.add(withoutLanguage);
  return [...variants];
}

export class AliasMatcher {
  score(field: CanonicalField, normalizedHeader: string) {
    return Math.max(...headerVariants(normalizedHeader).flatMap((variant) => normalizedAliases[field].map((alias) => similarity(variant, alias))));
  }

  match(columns: DetectedColumn[]) {
    const candidates = canonicalFields.flatMap(({ key }) => columns.map((column) => ({
      field: key,
      column: column.index,
      score: this.score(key, column.normalized)
    }))).filter((candidate) => candidate.score >= 0.78).sort((left, right) => right.score - left.score);

    const mapping: ColumnMapping = {};
    const confidence: Partial<Record<CanonicalField, number>> = {};
    const usedColumns = new Set<number>();
    for (const candidate of candidates) {
      if (mapping[candidate.field] || usedColumns.has(candidate.column)) continue;
      mapping[candidate.field] = candidate.column;
      confidence[candidate.field] = candidate.score;
      usedColumns.add(candidate.column);
    }
    return { mapping, confidence };
  }
}