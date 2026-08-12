import { HomeExperience } from "@/components/home-experience";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";
import { getHomeInitialData } from "@/lib/results";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const requestedYear = sp.year ? Number(sp.year) : undefined;
  const { dict, locale } = await getDictionary();
  const initial = await getHomeInitialData(Number.isInteger(requestedYear) ? requestedYear : undefined).catch(() => null);

  return <>
    <SiteHeader dict={dict} locale={locale} />
    <main>
      <HomeExperience
        dict={dict}
        locale={locale}
        initialMeta={initial ? { year: initial.year, session: initial.session, notices: initial.notices, years: initial.years, options: initial.options } : null}
        initialRankings={initial?.rankings ?? null}
      />
    </main>
    <SiteFooter dict={dict} />
  </>;
}
