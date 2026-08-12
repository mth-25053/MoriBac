"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { RankingsFilters } from "@/components/rankings/rankings-filters";
import { RankingsPodium } from "@/components/rankings/rankings-hero";
import { RankingsList } from "@/components/rankings/rankings-list";
import type { FilterOptions, RankingsResponse } from "@/components/rankings/types";

type YearOption = { year: number; isDefault: boolean; labelAr?: string | null; labelFr?: string | null };

function Skeleton() {
  return <div className="mt-10 space-y-4">
    <div className="skeleton h-64" />
    <div className="grid gap-4 sm:grid-cols-3"><div className="skeleton h-32" /><div className="skeleton h-32" /><div className="skeleton h-32" /></div>
  </div>;
}

export function RankingsSection({
  dict,
  locale,
  initialYear,
  years,
  initialOptions,
  initialData,
  onSelectCandidate
}: {
  dict: Dictionary;
  locale: Locale;
  initialYear: number;
  years: YearOption[];
  initialOptions: FilterOptions;
  initialData?: RankingsResponse | null;
  onSelectCandidate: (candidateNumber: string) => void;
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [series, setSeries] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [path, setPath] = useState<"school" | "center" | null>(null);

  const [options, setOptions] = useState<FilterOptions>(initialOptions);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [data, setData] = useState<RankingsResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeries = params.get("stream") ?? "";
    const urlWilaya = params.get("wilaya") ?? "";
    if (urlSeries) setSeries(urlSeries);
    if (urlWilaya) setWilaya(urlWilaya);
  }, []);

  const skipUrlWrite = useRef(true);
  useEffect(() => {
    if (skipUrlWrite.current) { skipUrlWrite.current = false; return; }
    const url = new URL(window.location.href);
    const set = (key: string, value: string) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); };
    set("stream", series);
    set("wilaya", wilaya);
    window.history.replaceState(null, "", url);
  }, [series, wilaya]);

  const optionsAbort = useRef<AbortController | null>(null);
  // The very first run would fetch the exact same unfiltered options the parent already
  // fetched to build `initialOptions` (same year, no series/wilaya) - skip that one redundant
  // request and reuse what was passed in. Any later run (a real filter change) fetches as before.
  const isFirstOptionsRun = useRef(true);
  useEffect(() => {
    if (isFirstOptionsRun.current) {
      isFirstOptionsRun.current = false;
      if (year === initialYear && !series && !wilaya) return;
    }
    optionsAbort.current?.abort();
    const controller = new AbortController();
    optionsAbort.current = controller;
    setOptionsLoading(true);
    const query = new URLSearchParams({ year: String(year) });
    if (series) query.set("series", series);
    if (wilaya) query.set("wilaya", wilaya);
    fetch(`/api/public/meta?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((meta: { options: FilterOptions }) => setOptions(meta.options))
      .catch((fetchError) => { if ((fetchError as { name?: string })?.name !== "AbortError") { /* keep previous options, filters remain usable */ } })
      .finally(() => { if (optionsAbort.current === controller) setOptionsLoading(false); });
    return () => controller.abort();
  }, [year, series, wilaya, initialYear]);

  const resultsAbort = useRef<AbortController | null>(null);
  // Mirrors isFirstOptionsRun above: the very first run would re-fetch the exact same
  // unfiltered Top Candidates page the server already rendered into initialData - skip it
  // and reuse what was passed in. Any later run (a real filter/year change) fetches as before.
  const isFirstResultsRun = useRef(true);
  useEffect(() => {
    if (isFirstResultsRun.current) {
      isFirstResultsRun.current = false;
      if (initialData && year === initialYear && !series && !wilaya) return;
    }
    resultsAbort.current?.abort();
    const controller = new AbortController();
    resultsAbort.current = controller;
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ year: String(year), sort: "highest", page: "1" });
    if (series) query.set("series", series);
    if (wilaya) query.set("wilaya", wilaya);
    fetch(`/api/public/results?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((json: RankingsResponse) => setData(json))
      .catch((fetchError) => { if ((fetchError as { name?: string })?.name !== "AbortError") setError(true); })
      .finally(() => { if (resultsAbort.current === controller) setLoading(false); });
    return () => controller.abort();
  }, [year, series, wilaya, initialData, initialYear]);

  function selectYear(value: number) { setYear(value); setSeries(""); setWilaya(""); setPath(null); }
  function selectSeries(value: string) { setSeries(value); setWilaya(""); setPath(null); }
  function selectWilaya(value: string) { setWilaya(value); setPath(null); }
  function selectPath(value: "school" | "center") { setPath(value); }
  function reset() { setSeries(""); setWilaya(""); setPath(null); }

  function entityHref(kind: "school" | "center", name: string) {
    const query = new URLSearchParams({ year: String(year) });
    if (wilaya) query.set("wilaya", wilaya);
    if (series) query.set("series", series);
    return `/${kind === "school" ? "schools" : "centers"}/${encodeURIComponent(name)}?${query.toString()}`;
  }

  function goToEntity(kind: "school" | "center", name: string) {
    router.push(entityHref(kind, name));
  }

  // Warms the route's RSC payload as soon as the visitor's pointer/focus lands on a
  // school/center option, so the click itself (goToEntity/router.push) resolves from
  // cache instead of waiting on a fresh server round-trip - makes the navigation feel
  // instant per the "every button should react immediately" requirement.
  function prefetchEntity(kind: "school" | "center", name: string) {
    router.prefetch(entityHref(kind, name));
  }

  const rest = data ? data.candidates.slice(3) : [];

  return <section id="rankings" className="shell mt-6 scroll-mt-24 sm:mt-10">
    <div className="text-center">
      <span className="eyebrow">{dict.rankingsEyebrow}</span>
      <h2 className="mt-2 text-3xl font-black sm:text-4xl">{dict.rankingsTitle}</h2>
      <p className="muted mx-auto mt-3 max-w-xl">{dict.rankingsSubtitle}</p>
    </div>

    <RankingsFilters
      dict={dict}
      locale={locale}
      years={years}
      year={year}
      series={series}
      wilaya={wilaya}
      path={path}
      options={options}
      optionsLoading={optionsLoading}
      hasActiveFilters={Boolean(series || wilaya)}
      onYear={selectYear}
      onSeries={selectSeries}
      onWilaya={selectWilaya}
      onPath={selectPath}
      onSchool={(name) => goToEntity("school", name)}
      onCenter={(name) => goToEntity("center", name)}
      onPrefetchSchool={(name) => prefetchEntity("school", name)}
      onPrefetchCenter={(name) => prefetchEntity("center", name)}
      onReset={reset}
    />

    {error && <p role="alert" className="mt-10 text-center text-sm font-bold text-[var(--danger)]">{dict.serviceUnavailable}</p>}
    {!error && loading && <Skeleton />}
    {!error && !loading && data && data.candidates.length === 0 && <p className="muted mt-10 text-center">{dict.rankingsEmpty}</p>}
    {!error && !loading && data && data.candidates.length > 0 && <>
      <RankingsPodium dict={dict} candidates={data.candidates} onSelect={onSelectCandidate} />
      <RankingsList dict={dict} candidates={rest} hasMore={false} loadingMore={false} onLoadMore={() => undefined} onSelect={onSelectCandidate} startRank={4} />
    </>}
  </section>;
}
