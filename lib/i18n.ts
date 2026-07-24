import { cookies } from "next/headers";
import { LANGUAGE_COOKIE } from "@/lib/constants";

export type Locale = "ar" | "fr";

export const dictionaries = {
  ar: {
    brand: "Mth_Bac", designCredit: "تصميم وتطوير: المثنى ولد أحمد باب", home: "الرئيسية", about: "عن المنصة", admin: "الإدارة",
    heroText: "أدخل رقم مترشحك واحصل على نتيجتك فوراً.",
    searchTitle: "البحث عن مترشح", candidateNumber: "رقم المترشح", search: "بحث", searching: "جارٍ البحث…",
    searchHint: "أدخل رقم المترشح كما هو، بما في ذلك الأصفار في البداية.", required: "هذا الحقل مطلوب.", invalidNumber: "رقم المترشح غير صالح.", notFound: "لم يتم العثور على نتيجة منشورة لهذا الرقم.",
    series: "الشعبة", wilaya: "الولاية", center: "مركز الامتحان", school: "المؤسسة",
    average: "المعدل", decision: "القرار",
    noResults: "لا توجد نتائج مطابقة.", loading: "جارٍ التحميل…", serviceUnavailable: "خدمة النتائج غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.", retry: "إعادة المحاولة", publishedYear: "السنة", footer: "منصة مستقلة لنشر النتائج بوضوح وأمان.",
    candidateResult: "نتيجة المترشح", backHome: "العودة إلى الرئيسية", theme: "تبديل المظهر", language: "Français",
    aboutTitle: "نتائج موثوقة، وتجربة تحترم الجميع.", aboutText: "صُمم Mth_Bac لتسهيل الوصول إلى نتائج البكالوريا الموريتانية من الهاتف أو الحاسوب، مع حماية البيانات الشخصية وإتاحة المعلومات الضرورية فقط.",
    privacyTitle: "الخصوصية أولاً", privacyText: "لا نعرض تاريخ الميلاد أو مكانه. البحث العام لا يتطلب إنشاء حساب.",
    accessibilityTitle: "متاحة للجميع", accessibilityText: "واجهة ثنائية اللغة، متوافقة مع لوحة المفاتيح، ومقروءة في الوضعين الفاتح والداكن.",
    decisions: { ADMIS: "🟢 ناجح", SESSIONNAIRE: "🟠 الدورة التكميلية", REDOUBLE: "🔴 راسب", ABSENT: "⚪ غائب", ANNULE: "⚪ ملغى" },
    congratulations: "🎉 ألف مبروك",
    searchAgain: "بحث عن رقم آخر",
    rankLabel: "الترتيب في الشعبة",
    rankingsEyebrow: "التصنيف الوطني",
    rankingsTitle: "لوحة الشرف",
    rankingsSubtitle: "أفضل 50 مترشحاً على المستوى الوطني، وإمكانية الاطلاع على نتائج كل ولاية أو مؤسسة أو مركز امتحان.",
    nationalChampion: "البطل الوطني",
    championOfSeries: "بطل شعبة",
    championOfWilaya: "بطل ولاية",
    topOfSchool: "الأول في مؤسسة",
    topOfCenter: "الأول في مركز",
    rankFirst: "🥇 الأول",
    rankSecond: "🥈 الثاني",
    rankThird: "🥉 الثالث",
    allSeries: "جميع الشعب",
    allWilayas: "جميع الولايات",
    choosePath: "اختر طريقة العرض",
    viewBySchool: "🏫 المؤسسة",
    viewByCenter: "📍 مركز الامتحان",
    selectSchool: "اختر المؤسسة",
    selectCenter: "اختر مركز الامتحان",
    rankingsEmpty: "لا توجد بيانات كافية لعرضها بعد.",
    loadMore: "عرض المزيد",
    resetFilters: "إعادة الضبط",
    rank: "الترتيب",
    statTotal: "إجمالي المترشحين",
    statPassed: "ناجح",
    statFailed: "راسب",
    statResit: "الدورة التكميلية",
    statCancelled: "ملغى",
    statAbsent: "غائب",
    statSuccessRate: "نسبة النجاح",
    statHighest: "أعلى معدل",
    statLowest: "أدنى معدل"
  },
  fr: {
    brand: "Mth_Bac", designCredit: "تصميم وتطوير: المثنى ولد أحمد باب", home: "Accueil", about: "À propos", admin: "Administration",
    heroText: "Entrez votre numéro de candidat et obtenez votre résultat instantanément.",
    searchTitle: "Rechercher un candidat", candidateNumber: "Numéro du candidat", search: "Rechercher", searching: "Recherche…",
    searchHint: "Saisissez le numéro tel quel, y compris les zéros initiaux.", required: "Ce champ est obligatoire.", invalidNumber: "Numéro de candidat invalide.", notFound: "Aucun résultat publié ne correspond à ce numéro.",
    series: "Série", wilaya: "Wilaya", center: "Centre d’examen", school: "Établissement",
    average: "Moyenne", decision: "Décision",
    noResults: "Aucun résultat correspondant.", loading: "Chargement…", serviceUnavailable: "Le service des résultats est momentanément indisponible. Veuillez réessayer.", retry: "Réessayer", publishedYear: "Année", footer: "Une plateforme indépendante pour des résultats clairs et sûrs.",
    candidateResult: "Résultat du candidat", backHome: "Retour à l’accueil", theme: "Changer le thème", language: "العربية",
    aboutTitle: "Des résultats fiables, une expérience respectueuse.", aboutText: "Mth_Bac facilite l’accès aux résultats du baccalauréat mauritanien sur mobile et ordinateur, tout en protégeant les données personnelles et en n’affichant que l’essentiel.",
    privacyTitle: "La confidentialité d’abord", privacyText: "La date et le lieu de naissance ne sont jamais affichés. Aucun compte n’est requis pour consulter les résultats.",
    accessibilityTitle: "Accessible à tous", accessibilityText: "Une interface bilingue, utilisable au clavier et lisible en thèmes clair et sombre.",
    decisions: { ADMIS: "🟢 Admis", SESSIONNAIRE: "🟠 Session complémentaire", REDOUBLE: "🔴 Non admis", ABSENT: "⚪ Absent", ANNULE: "⚪ Annulé" },
    congratulations: "🎉 Félicitations !",
    searchAgain: "Rechercher un autre numéro",
    rankLabel: "Rang dans la série",
    rankingsEyebrow: "Classement national",
    rankingsTitle: "Tableau d’honneur",
    rankingsSubtitle: "Top 50 des candidats au niveau national, avec la possibilité de consulter chaque wilaya, établissement ou centre d’examen.",
    nationalChampion: "Champion national",
    championOfSeries: "Champion de la série",
    championOfWilaya: "Champion de la wilaya",
    topOfSchool: "Premier de l’établissement",
    topOfCenter: "Premier du centre",
    rankFirst: "🥇 1er",
    rankSecond: "🥈 2e",
    rankThird: "🥉 3e",
    allSeries: "Toutes les séries",
    allWilayas: "Toutes les wilayas",
    choosePath: "Choisissez un mode d’affichage",
    viewBySchool: "🏫 Établissement",
    viewByCenter: "📍 Centre d’examen",
    selectSchool: "Sélectionner l’établissement",
    selectCenter: "Sélectionner le centre d’examen",
    rankingsEmpty: "Pas encore assez de données à afficher.",
    loadMore: "Afficher plus",
    resetFilters: "Réinitialiser",
    rank: "Rang",
    statTotal: "Total des candidats",
    statPassed: "Admis",
    statFailed: "Non admis",
    statResit: "Session complémentaire",
    statCancelled: "Annulé",
    statAbsent: "Absent",
    statSuccessRate: "Taux de réussite",
    statHighest: "Moyenne la plus haute",
    statLowest: "Moyenne la plus basse"
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
