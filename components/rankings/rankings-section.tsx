"use client";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { RankingsFilters } from "@/components/rankings/rankings-filters";
import { RankingsHero } from "@/components/rankings/rankings-hero";
import { RankingsList } from "@/components/rankings/rankings-list";
import { RankingsStats } from "@/components/rankings/rankings-stats";
import { rankingsScope, type FilterOptions, type RankingsResponse } from "@/components/rankings/types";

type YearOption = { year: number; isDefault: boolean };

function Skeleton() {
  return <div className="mt-10 space-y-4">
    <div className="skeleton h-64" />
    <div className="grid gap-4 sm:grid-cols-3"><div className="skeleton h-32" /><div className="skeleton h-32" /><div className="skeleton h-32" /></div>
  </div>;
}

export function RankingsSection({
  dict,
  initialYear,
  years,
  initialOptions
}: {
  dict: Dictionary;
  initialYear: number;
  years: YearOption[];
  initialOptions: FilterOptions;
}) {
  const [year, setYear] = useState(initialYear);
  const [series, setSeries] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [path, setPath] = useState<"school" | "center" | null>(null);
  const [school, setSchool] = useState("");
  const [examCenter, setExamCenter] = useState("");

  const [options, setOptions] = useState<FilterOptions>(initialOptions);
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const optionsAbort = useRef<AbortController | null>(null);
  const lastOptionsKey = useRef("");
  useEffect(() => {
    const key = `${year}:${series}:${wilaya}`;
    if (lastOptionsKey.current === key) return;
    lastOptionsKey.current = key;
    optionsAbort.current?.abort();
    const controller = new AbortController();
    optionsAbort.current = controller;
    const query = new URLSearchParams({ year: String(year) });
    if (series) query.set("series", series);
    if (wilaya) query.set("wilaya", wilaya);
    fetch(`/api/public/meta?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((meta: { options: FilterOptions }) => setOptions(meta.options))
      .catch((fetchError) => { if ((fetchError as { name?: string })?.name !== "AbortError") { /* keep previous options, filters remain usable */ } });
    return () => controller.abort();
  }, [year, series, wilaya]);

  const resultsAbort = useRef<AbortController | null>(null);
  const lastResultsKey = useRef("");
  useEffect(() => {
    const key = `${year}:${series}:${wilaya}:${school}:${examCenter}`;
    if (lastResultsKey.current === key) return;
    lastResultsKey.current = key;
    resultsAbort.current?.abort();
    const controller = new AbortController();
    resultsAbort.current = controller;
    setLoading(true);
    setError(false);
    setPage(1);
    const query = new URLSearchParams({ year: String(year), sort: "highest", page: "1" });
    if (series) query.set("series", series);
    if (wilaya) query.set("wilaya", wilaya);
    if (school) query.set("school", school);
    else if (examCenter) query.set("center", examCenter);
    fetch(`/api/public/results?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((json: RankingsResponse) => setData(json))
      .catch((fetchError) => { if ((fetchError as { name?: string })?.name !== "AbortError") setError(true); })
      .finally(() => { if (resultsAbort.current === controller) setLoading(false); });
    return () => controller.abort();
  }, [year, series, wilaya, school, examCenter]);

  async function loadMore() {
    if (!data || loadingMore || page >= data.pageCount) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const query = new URLSearchParams({ year: String(year), sort: "highest", page: String(nextPage) });
      if (series) query.set("series", series);
      if (wilaya) query.set("wilaya", wilaya);
      if (school) query.set("school", school);
      else if (examCenter) query.set("center", examCenter);
      const response = await fetch(`/api/public/results?${query}`);
      if (!response.ok) return;
      const json: RankingsResponse = await response.json();
      setData((current) => (current ? { ...json, candidates: [...current.candidates, ...json.candidates] } : json));
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  function selectYear(value: number) { setYear(value); setSeries(""); setWilaya(""); setPath(null); setSchool(""); setExamCenter(""); }
  function selectSeries(value: string) { setSeries(value); setWilaya(""); setPath(null); setSchool(""); setExamCenter(""); }
  function selectWilaya(value: string) { setWilaya(value); setPath(null); setSchool(""); setExamCenter(""); }
  function selectPath(value: "school" | "center") { setPath(value); setSchool(""); setExamCenter(""); }
  function reset() { setSeries(""); setWilaya(""); setPath(null); setSchool(""); setExamCenter(""); }

  const detailed = Boolean(school || examCenter);
  const scope = rankingsScope({ series, wilaya, school, examCenter });
  const rest = data ? data.candidates.slice(3) : [];

  return <section className="shell mt-16 sm:mt-24">
    <div className="text-center">
      <span className="eyebrow">{dict.rankingsEyebrow}</span>
      <h2 className="mt-2 text-3xl font-black sm:text-4xl">{dict.rankingsTitle}</h2>
      <p className="muted mx-auto mt-3 max-w-xl">{dict.rankingsSubtitle}</p>
    </div>

    <RankingsFilters
      dict={dict}
      years={years}
      year={year}
      series={series}
      wilaya={wilaya}
      path={path}
      school={school}
      examCenter={examCenter}
      options={options}
      hasActiveFilters={Boolean(series || wilaya)}
      onYear={selectYear}
      onSeries={selectSeries}
      onWilaya={selectWilaya}
      onPath={selectPath}
      onSchool={setSchool}
      onCenter={setExamCenter}
      onReset={reset}
    />

    {error && <p role="alert" className="mt-10 text-center text-sm font-bold text-[var(--danger)]">{dict.serviceUnavailable}</p>}
    {!error && loading && <Skeleton />}
    {!error && !loading && data && data.candidates.length === 0 && <p className="muted mt-10 text-center">{dict.rankingsEmpty}</p>}
    {!error && !loading && data && data.candidates.length > 0 && <>
      <RankingsHero dict={dict} candidates={data.candidates} scope={scope} series={series} wilaya={wilaya} school={school} examCenter={examCenter} />
      {detailed && data.statistics && <RankingsStats dict={dict} statistics={data.statistics} />}
      <RankingsList dict={dict} candidates={rest} hasMore={page < data.pageCount} loadingMore={loadingMore} onLoadMore={loadMore} />
    </>}
  </section>;
}
