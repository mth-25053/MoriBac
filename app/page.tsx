import type { ExamSession } from "@prisma/client";
import { HomeExperience } from "@/components/home-experience";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";
import { getHomeInitialData } from "@/lib/results";

function parseSession(value: string | undefined): ExamSession | undefined {
  return value === "NORMAL" || value === "COMPLEMENTAIRE" ? value : undefined;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ year?: string; session?: string }> }) {
  const sp = await searchParams;
  const requestedYear = sp.year ? Number(sp.year) : undefined;
  const requestedSession = parseSession(sp.session);
  const { dict, locale } = await getDictionary();
  const initial = await getHomeInitialData(Number.isInteger(requestedYear) ? requestedYear : undefined, requestedSession).catch(() => null);

  return <>
    <SiteHeader dict={dict} locale={locale} />
    <main>
      <HomeExperience
        dict={dict}
        locale={locale}
        initialMeta={initial ? { year: initial.year, session: initial.session, labelAr: initial.labelAr, labelFr: initial.labelFr, notices: initial.notices, years: initial.years, options: initial.options } : null}
        initialRankings={initial?.rankings ?? null}
      />
    </main>
    <SiteFooter dict={dict} />
  </>;
}
