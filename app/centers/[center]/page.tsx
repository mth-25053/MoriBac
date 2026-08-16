import type { Metadata } from "next";
import type { ExamSession } from "@prisma/client";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RosterPage } from "@/components/rankings/roster-page";
import { getDictionary } from "@/lib/i18n";
import { getRosterInitialData } from "@/lib/results";

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function parseSession(value: string | undefined): ExamSession | undefined {
  return value === "NORMAL" || value === "COMPLEMENTAIRE" ? value : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ center: string }> }): Promise<Metadata> {
  const { center } = await params;
  return { title: safeDecode(center) };
}

export default async function CenterPage({
  params,
  searchParams
}: {
  params: Promise<{ center: string }>;
  searchParams: Promise<{ year?: string; session?: string; wilaya?: string; series?: string }>;
}) {
  const { center } = await params;
  const sp = await searchParams;
  const name = safeDecode(center);
  const { dict, locale } = await getDictionary();
  const requestedYear = sp.year ? Number(sp.year) : undefined;
  const requestedSession = parseSession(sp.session);
  const wilaya = sp.wilaya ?? "";
  const series = sp.series ?? "";
  const initial = await getRosterInitialData("center", name, { year: requestedYear, session: requestedSession, wilaya, series });

  return <>
    <SiteHeader dict={dict} locale={locale} />
    <main>
      {initial ? (
        <RosterPage
          dict={dict}
          kind="center"
          name={name}
          wilaya={wilaya}
          series={series}
          year={initial.year}
          session={initial.session}
          yearLabel={(locale === "ar" ? initial.labelAr : initial.labelFr) || null}
          initialCandidates={initial.candidates}
          initialPageCount={initial.pageCount}
          initialStatistics={initial.statistics}
        />
      ) : (
        <section className="shell py-16 text-center">
          <p className="muted">{dict.serviceUnavailable}</p>
          <Link href="/#rankings" className="button secondary mt-6 inline-flex">{dict.backToRankings}</Link>
        </section>
      )}
    </main>
    <SiteFooter dict={dict} />
  </>;
}
