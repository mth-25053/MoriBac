"use client";
import { Award, CalendarDays, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { RankingsList } from "@/components/rankings/rankings-list";
import { RankingsStats } from "@/components/rankings/rankings-stats";
import type { RankingCandidate, RankingStatistics, RankingsResponse } from "@/components/rankings/types";

export function RosterPage({
  dict,
  kind,
  name,
  wilaya,
  series,
  year,
  session,
  yearLabel,
  initialCandidates,
  initialPageCount,
  initialStatistics
}: {
  dict: Dictionary;
  kind: "school" | "center";
  name: string;
  wilaya: string;
  series: string;
  year: number;
  session?: string;
  yearLabel?: string | null;
  initialCandidates: RankingCandidate[];
  initialPageCount: number;
  initialStatistics: RankingStatistics | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState(initialCandidates);
  const [statistics, setStatistics] = useState(initialStatistics);
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  function buildParams(pageNumber: number, nameFilter: string) {
    const params = new URLSearchParams({ year: String(year), sort: "highest", page: String(pageNumber) });
    if (session) params.set("session", session);
    if (series) params.set("series", series);
    if (wilaya) params.set("wilaya", wilaya);
    if (kind === "school") params.set("school", name); else params.set("center", name);
    if (nameFilter) params.set("name", nameFilter);
    return params;
  }

  const abortRef = useRef<AbortController | null>(null);
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(false);
      setPage(1);
      fetch(`/api/public/results?${buildParams(1, trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((json: RankingsResponse) => { setCandidates(json.candidates); setStatistics(json.statistics); setPageCount(json.pageCount); })
        .catch((fetchError) => { if ((fetchError as { name?: string })?.name !== "AbortError") setError(true); })
        .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function loadMore() {
    if (loadingMore || page >= pageCount) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/public/results?${buildParams(nextPage, query.trim())}`);
      if (!response.ok) return;
      const json: RankingsResponse = await response.json();
      setCandidates((current) => [...current, ...json.candidates]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  function openCandidate(candidateNumber: string) {
    router.push(`/?number=${encodeURIComponent(candidateNumber)}&year=${year}${session ? `&session=${session}` : ""}`);
  }

  const contextLabel = kind === "school" ? dict.school : dict.center;

  return <section className="shell py-10 sm:py-14">
    <Link href="/#rankings" className="button secondary inline-flex">{dict.backToRankings}</Link>

    <div className="surface reveal mt-6 p-6 text-center sm:p-10">
      <span className="eyebrow">{contextLabel}</span>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl"><bdi>{name}</bdi></h1>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-bold">
        <span className="muted flex items-center gap-1.5"><MapPin size={15} /><bdi>{wilaya || dict.allWilayas}</bdi></span>
        <span className="muted flex items-center gap-1.5"><Award size={15} /><bdi>{series || dict.allSeries}</bdi></span>
        <span className="muted flex items-center gap-1.5" dir="ltr"><CalendarDays size={15} />{yearLabel || `BAC ${year}`}</span>
      </div>
    </div>

    {statistics && <RankingsStats dict={dict} statistics={statistics} />}

    <div className="surface mt-8 p-4 sm:p-5">
      <label className="label" htmlFor="roster-search">{dict.searchInRoster}</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3" style={{ color: "var(--muted)" }} />
        <input id="roster-search" className="field has-icon" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dict.searchInRosterPlaceholder} autoComplete="off" />
      </div>
    </div>

    {error && <p role="alert" className="mt-8 text-center text-sm font-bold text-[var(--danger)]">{dict.serviceUnavailable}</p>}
    {!error && loading && <div className="mt-8 space-y-3"><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" /></div>}
    {!error && !loading && candidates.length === 0 && <p className="muted mt-8 text-center">{dict.rankingsEmpty}</p>}
    {!error && !loading && candidates.length > 0 && <RankingsList dict={dict} candidates={candidates} hasMore={page < pageCount} loadingMore={loadingMore} onLoadMore={loadMore} onSelect={openCandidate} startRank={1} />}
  </section>;
}
