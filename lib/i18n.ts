import { cookies } from "next/headers";
import { LANGUAGE_COOKIE } from "@/lib/constants";

export type Locale = "ar" | "fr";

export const dictionaries = {
  ar: {
    brand: "موري باك", home: "الرئيسية", about: "عن المنصة", admin: "الإدارة",
    heroEyebrow: "نتائج البكالوريا الموريتانية", heroTitle: "نتيجتك، بكل وضوح.",
    heroText: "ابحث برقم المترشح أو تصفّح النتائج حسب الشعبة والمركز والمدرسة.",
    searchTitle: "البحث عن مترشح", candidateNumber: "رقم المترشح", search: "بحث", searching: "جارٍ البحث…",
    searchHint: "أدخل رقم المترشح كما هو، بما في ذلك الأصفار في البداية.", required: "هذا الحقل مطلوب.", invalidNumber: "رقم المترشح غير صالح.", notFound: "لم يتم العثور على نتيجة منشورة لهذا الرقم.",
    browseTitle: "تصفّح النتائج", chooseSeries: "اختر الشعبة لعرض أفضل 10 مترشحين.", series: "الشعبة", wilaya: "الولاية", center: "مركز الامتحان", school: "المؤسسة", all: "الكل",
    topTen: "أفضل 10 مترشحين", centerResults: "نتائج المركز", schoolResults: "نتائج المؤسسة",
    rank: "الترتيب", name: "الاسم الكامل", average: "المعدل", decision: "القرار", number: "الرقم", previous: "السابق", next: "التالي", page: "صفحة",
    totalCandidates: "إجمالي المترشحين", totalPassed: "الناجحون", sessionCandidates: "الدورة التكميلية", failedCandidates: "غير الناجحين", highestAverage: "أعلى معدل", successRate: "نسبة النجاح",
    noResults: "لا توجد نتائج مطابقة.", loading: "جارٍ التحميل…", serviceUnavailable: "خدمة النتائج غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.", retry: "إعادة المحاولة", publishedYear: "السنة", footer: "منصة مستقلة لنشر النتائج بوضوح وأمان.",
    candidateResult: "نتيجة المترشح", backHome: "العودة إلى الرئيسية", theme: "تبديل المظهر", language: "Français", select: "اختر",
    sort: "الترتيب", highest: "أعلى معدل", lowest: "أدنى معدل", sortName: "الاسم", sortNumber: "رقم المترشح",
    aboutTitle: "نتائج موثوقة، وتجربة تحترم الجميع.", aboutText: "صُممت موري باك لتسهيل الوصول إلى نتائج البكالوريا الموريتانية من الهاتف أو الحاسوب، مع حماية البيانات الشخصية وإتاحة المعلومات الضرورية فقط.",
    privacyTitle: "الخصوصية أولاً", privacyText: "لا نعرض تاريخ الميلاد أو مكانه. البحث العام لا يتطلب إنشاء حساب.",
    accessibilityTitle: "متاحة للجميع", accessibilityText: "واجهة ثنائية اللغة، متوافقة مع لوحة المفاتيح، ومقروءة في الوضعين الفاتح والداكن.",
    decisions: { ADMIS: "ناجح", SESSIONNAIRE: "الدورة التكميلية", REDOUBLE: "راسب", ABSENT: "غائب", ANNULE: "ملغى" }
  },
  fr: {
    brand: "MoriBac", home: "Accueil", about: "À propos", admin: "Administration",
    heroEyebrow: "Résultats du baccalauréat mauritanien", heroTitle: "Votre résultat, en toute clarté.",
    heroText: "Recherchez un numéro de candidat ou parcourez les résultats par série, centre et établissement.",
    searchTitle: "Rechercher un candidat", candidateNumber: "Numéro du candidat", search: "Rechercher", searching: "Recherche…",
    searchHint: "Saisissez le numéro tel quel, y compris les zéros initiaux.", required: "Ce champ est obligatoire.", invalidNumber: "Numéro de candidat invalide.", notFound: "Aucun résultat publié ne correspond à ce numéro.",
    browseTitle: "Parcourir les résultats", chooseSeries: "Choisissez une série pour afficher les 10 premiers candidats.", series: "Série", wilaya: "Wilaya", center: "Centre d’examen", school: "Établissement", all: "Tous",
    topTen: "Top 10 de la série", centerResults: "Résultats du centre", schoolResults: "Résultats de l’établissement",
    rank: "Rang", name: "Nom complet", average: "Moyenne", decision: "Décision", number: "Numéro", previous: "Précédent", next: "Suivant", page: "Page",
    totalCandidates: "Total candidats", totalPassed: "Admis", sessionCandidates: "Sessionnaires", failedCandidates: "Non admis", highestAverage: "Meilleure moyenne", successRate: "Taux de réussite",
    noResults: "Aucun résultat correspondant.", loading: "Chargement…", serviceUnavailable: "Le service des résultats est momentanément indisponible. Veuillez réessayer.", retry: "Réessayer", publishedYear: "Année", footer: "Une plateforme indépendante pour des résultats clairs et sûrs.",
    candidateResult: "Résultat du candidat", backHome: "Retour à l’accueil", theme: "Changer le thème", language: "العربية", select: "Choisir",
    sort: "Trier", highest: "Meilleure moyenne", lowest: "Moyenne la plus basse", sortName: "Nom", sortNumber: "Numéro du candidat",
    aboutTitle: "Des résultats fiables, une expérience respectueuse.", aboutText: "MoriBac facilite l’accès aux résultats du baccalauréat mauritanien sur mobile et ordinateur, tout en protégeant les données personnelles et en n’affichant que l’essentiel.",
    privacyTitle: "La confidentialité d’abord", privacyText: "La date et le lieu de naissance ne sont jamais affichés. Aucun compte n’est requis pour consulter les résultats.",
    accessibilityTitle: "Accessible à tous", accessibilityText: "Une interface bilingue, utilisable au clavier et lisible en thèmes clair et sombre.",
    decisions: { ADMIS: "Admis", SESSIONNAIRE: "Session complémentaire", REDOUBLE: "Non admis", ABSENT: "Absent", ANNULE: "Annulé" }
  }
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return value === "fr" ? "fr" : "ar";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, dict: dictionaries[locale] };
}
