import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { classifyDecision } from "@/lib/decision";
import { dictionaries, type Locale } from "@/lib/i18n";
import { databaseUnavailable } from "@/lib/database-errors";
import { getCandidateSubjectGrades } from "@/lib/grades/public-grades";
import { subjectDisplayName } from "@/lib/grades/subject-grades-client";
import { apiError } from "@/lib/http";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import { ResultDocument, type ResultPdfData, type ResultPdfRank } from "@/lib/pdf/result-document";
import { isRateLimited } from "@/lib/rate-limit";
import { findCandidateResult, getCandidateRanks, getPublishedYearCached } from "@/lib/results";
import { candidateSearchSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

function rankOrNull(rank: number | null, total: number | null): ResultPdfRank | null {
  return rank !== null && total !== null ? { rank, total } : null;
}

/**
 * Decision labels in the dictionary (e.g. "🟢 ناجح") carry a leading emoji for the
 * web UI, which renders through the browser's own emoji font. The embedded PDF
 * fonts (Tajawal/Lato) have no emoji glyphs, so an un-stripped emoji renders as a
 * broken/missing-glyph mark in the generated document - confirmed by rendering
 * and visually inspecting a test PDF. Stripped here, PDF-only; the web dictionary
 * itself is untouched.
 */
function stripLeadingEmoji(label: string) {
  return label.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u, "");
}

/** Fetches every field the PDF needs and shapes it into ResultPdfData - no JSX here, so the lookup's try/catch (for transient database failures) never wraps a React element. */
async function loadResultPdfData(year: { id: string; year: number }, candidateNumber: string, locale: Locale, dict: (typeof dictionaries)[Locale]): Promise<ResultPdfData | null> {
  const candidate = await findCandidateResult(year.id, candidateNumber);
  if (!candidate) return null;

  const average = Number(candidate.average);
  const [ranks, grades] = await Promise.all([
    getCandidateRanks(year.id, { series: candidate.series, wilaya: candidate.wilaya, school: candidate.school, examCenter: candidate.examCenter, average, decision: candidate.decision }),
    getCandidateSubjectGrades(year.id, candidate.candidateNumber)
  ]);

  const known = classifyDecision(candidate.decision);
  const decisionLabel = stripLeadingEmoji(known ? dict.decisions[known] : candidate.decision);

  return {
    locale,
    brand: dict.brand,
    year: year.year,
    fullName: candidate.fullName,
    candidateNumber: candidate.candidateNumber,
    series: candidate.series,
    school: candidate.school,
    examCenter: candidate.examCenter,
    average,
    decisionLabel,
    nationalRank: rankOrNull(ranks.national, ranks.nationalTotal),
    schoolRank: rankOrNull(ranks.school, ranks.schoolTotal),
    examCenterRank: rankOrNull(ranks.examCenter, ranks.examCenterTotal),
    subjects: (grades ?? []).map((grade) => ({
      name: subjectDisplayName(grade, locale),
      coefficient: grade.coefficient,
      mark: grade.mark,
      status: grade.status
    })),
    generatedAt: new Date()
  };
}

export async function GET(request: Request) {
  if (isRateLimited(request, "public-pdf")) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const url = new URL(request.url);
  const parsedNumber = candidateSearchSchema.safeParse({ number: url.searchParams.get("number") });
  if (!parsedNumber.success) return NextResponse.json({ error: "INVALID_NUMBER" }, { status: 400 });

  const yearValue = url.searchParams.get("year");
  const requestedYear = yearValue ? Number(yearValue) : undefined;
  if (requestedYear !== undefined && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)) {
    return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });
  }

  const localeParam = url.searchParams.get("locale");
  const locale: Locale = localeParam === "fr" ? "fr" : "ar";
  const dict = dictionaries[locale];

  let data: ResultPdfData | null;
  try {
    const year = await getPublishedYearCached(requestedYear);
    if (!year) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    data = await loadResultPdfData(year, parsedNumber.data.number, locale, dict);
  } catch (error) {
    return databaseUnavailable(error, "candidate-result-pdf");
  }
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  registerPdfFonts();
  const element = <ResultDocument data={data} />;

  try {
    const buffer = await renderToBuffer(element);
    const fileName = `mthbac-${data.year}-${data.candidateNumber}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    console.error("[candidate-result-pdf:render] PDF rendering failed", error);
    return apiError("PDF_RENDER_FAILED", 500);
  }
}
