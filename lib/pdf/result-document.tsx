import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Locale } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n";
import { PDF_FONT_ARABIC, PDF_FONT_LATIN } from "@/lib/pdf/fonts";

export type ResultPdfSubjectRow = {
  name: string;
  coefficient: number | null;
  mark: number | null;
  status: "GRADED" | "EXEMPT";
};

export type ResultPdfRank = { rank: number; total: number };

/**
 * Deliberately narrow: only fields explicitly required by the PDF spec. No
 * candidate id, examYearId, importBatchId, birthDate/birthPlace, or any other
 * internal/private field ever reaches this type, so it can never leak into the PDF.
 */
export type ResultPdfData = {
  locale: Locale;
  brand: string;
  year: number;
  fullName: string;
  candidateNumber: string;
  series: string;
  school: string | null;
  examCenter: string | null;
  average: number;
  decisionLabel: string;
  nationalRank: ResultPdfRank | null;
  schoolRank: ResultPdfRank | null;
  examCenterRank: ResultPdfRank | null;
  subjects: ResultPdfSubjectRow[];
  generatedAt: Date;
};

function formatMark(value: number) {
  return `${value.toFixed(2)} /20`;
}

function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "fr", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function docTitleLabel(title: string, year: number) {
  return `${title} ${year}`;
}

function footerDateLabel(label: string, date: string) {
  return `${label}: ${date}`;
}

const ARABIC_SCRIPT = /[؀-ۿ]/;

/**
 * A subject with no confirmed French name falls back to its Arabic name
 * (subjectDisplayName in lib/grades/subject-grades-client.ts) even inside a
 * French-locale document. Lato has no Arabic glyphs, so that fallback text
 * rendered as garbage until this per-cell override was added - confirmed by
 * rendering and visually inspecting a French PDF with an unresolved subject.
 */
function textFontFamily(text: string, documentIsArabic: boolean) {
  const isArabic = ARABIC_SCRIPT.test(text);
  if (isArabic === documentIsArabic) return {};
  return { fontFamily: isArabic ? PDF_FONT_ARABIC : PDF_FONT_LATIN };
}

export function ResultDocument({ data }: { data: ResultPdfData }) {
  const dict = dictionaries[data.locale];
  const rtl = data.locale === "ar";
  const fontFamily = rtl ? PDF_FONT_ARABIC : PDF_FONT_LATIN;
  const align: "right" | "left" = rtl ? "right" : "left";
  const rowDirection: "row-reverse" | "row" = rtl ? "row-reverse" : "row";

  const styles = StyleSheet.create({
    page: { paddingTop: 32, paddingLeft: 32, paddingRight: 32, paddingBottom: 90, fontFamily, fontSize: 10.5, color: "#1a1a1a", direction: rtl ? "rtl" : "ltr" },
    header: { flexDirection: rowDirection, justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderColor: "#111", paddingBottom: 10, marginBottom: 14 },
    brand: { fontSize: 18, fontWeight: 700 },
    docTitle: { fontSize: 12, fontWeight: 700 },
    sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, textAlign: align },
    infoGrid: { flexDirection: rowDirection, flexWrap: "wrap", marginBottom: 14 },
    infoItem: { width: "50%", marginBottom: 8, textAlign: align },
    infoLabel: { fontSize: 8.5, color: "#555" },
    infoValue: { fontSize: 11.5, fontWeight: 700, marginTop: 1 },
    averageBlock: { alignItems: "center", marginVertical: 12, padding: 10, backgroundColor: "#f2f2f2" },
    averageValue: { fontSize: 26, fontWeight: 700 },
    averageLabel: { fontSize: 9, color: "#555", marginTop: 2 },
    rankRow: { flexDirection: rowDirection, flexWrap: "wrap", marginBottom: 14, gap: 8 },
    rankItem: { flexGrow: 1, borderWidth: 1, borderColor: "#ccc", padding: 8, textAlign: align },
    rankLabel: { fontSize: 8.5, color: "#555" },
    rankValueRow: { flexDirection: rowDirection, alignItems: "baseline", marginTop: 2, gap: 4 },
    rankValue: { fontSize: 12, fontWeight: 700 },
    rankValueConnector: { fontSize: 9, color: "#555" },
    table: { borderWidth: 1, borderColor: "#333" },
    tableHeaderRow: { flexDirection: rowDirection, backgroundColor: "#e8e8e8", borderBottomWidth: 1, borderColor: "#333" },
    tableRow: { flexDirection: rowDirection, borderBottomWidth: 0.5, borderColor: "#999" },
    cellSubject: { flex: 3, padding: 6, fontSize: 10, textAlign: align },
    cellCoef: { flex: 1, padding: 6, fontSize: 10, textAlign: "center" },
    cellMark: { flex: 1, padding: 6, fontSize: 10, textAlign: "center" },
    headerCell: { fontWeight: 700, fontSize: 9.5 },
    footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderColor: "#ccc", paddingTop: 8 },
    footerDate: { fontSize: 8.5, color: "#555", textAlign: align },
    footerDisclaimer: { fontSize: 7.5, color: "#777", marginTop: 4, textAlign: align, lineHeight: 1.4 }
  });

  const infoItems: Array<[string, string]> = [
    [dict.fullNameLabel, data.fullName],
    [dict.candidateNumber, data.candidateNumber],
    [dict.series, data.series],
    [dict.school, data.school ?? "—"],
    [dict.center, data.examCenter ?? "—"],
    [dict.decision, data.decisionLabel]
  ];

  const rankItems: Array<[string, ResultPdfRank | null]> = [
    [dict.rankNationalLabel, data.nationalRank],
    [dict.rankSchoolLabel, data.schoolRank],
    [dict.rankCenterLabel, data.examCenterRank]
  ];
  const availableRanks = rankItems.filter(([, value]) => value !== null) as Array<[string, ResultPdfRank]>;

  return <Document title={`${dict.pdfDocumentTitle} ${data.year} — ${data.candidateNumber}`}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>{data.brand}</Text>
        <Text style={styles.docTitle}>{docTitleLabel(dict.pdfDocumentTitle, data.year)}</Text>
      </View>

      <View style={styles.infoGrid}>
        {infoItems.map(([label, value]) => <View key={label} style={styles.infoItem}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>)}
      </View>

      <View style={styles.averageBlock}>
        <Text style={styles.averageValue}>{formatMark(data.average)}</Text>
        <Text style={styles.averageLabel}>{dict.average}</Text>
      </View>

      {availableRanks.length > 0 && <View>
        <Text style={styles.sectionTitle}>{dict.rankingsResultsTitle}</Text>
        <View style={styles.rankRow}>
          {availableRanks.map(([label, value]) => <View key={label} style={styles.rankItem}>
            <Text style={styles.rankLabel}>{label}</Text>
            {/*
              Three separate Text nodes in a row-reverse View, not one Text with an
              interpolated "{rank} {outOf} {total}" string: @react-pdf/textkit's bidi
              reordering visibly corrupts the order of two adjacent Western-digit runs
              inside a single RTL Text (verified by rendering "9 من أصل 24" and getting
              "من أصل 24 9" back) - confirmed by isolating it in a minimal test PDF.
              Flexbox row-reverse, the same mechanism the (correctly rendering) subject
              table already relies on for column order, sidesteps the bug entirely.
            */}
            <View style={styles.rankValueRow}>
              <Text style={styles.rankValue}>{value.rank}</Text>
              <Text style={styles.rankValueConnector}>{dict.outOf}</Text>
              <Text style={styles.rankValue}>{value.total}</Text>
            </View>
          </View>)}
        </View>
      </View>}

      <Text style={styles.sectionTitle}>{dict.subjectGradesTitle}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.cellSubject, styles.headerCell]}>{dict.subjectColumnLabel}</Text>
          <Text style={[styles.cellCoef, styles.headerCell]}>{dict.coefficientColumnLabel}</Text>
          <Text style={[styles.cellMark, styles.headerCell]}>{dict.markColumnLabel}</Text>
        </View>
        {data.subjects.map((subject, index) => <View key={`${subject.name}-${index}`} style={styles.tableRow}>
          <Text style={[styles.cellSubject, textFontFamily(subject.name, rtl)]}>{subject.name}</Text>
          <Text style={styles.cellCoef}>{subject.coefficient ?? "—"}</Text>
          <Text style={styles.cellMark}>{subject.status === "EXEMPT" ? dict.exemptLabel : formatMark(subject.mark as number)}</Text>
        </View>)}
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerDate}>{footerDateLabel(dict.pdfGeneratedOn, formatDate(data.generatedAt, data.locale))}</Text>
        <Text style={styles.footerDisclaimer}>{dict.pdfDisclaimer}</Text>
      </View>
    </Page>
  </Document>;
}
