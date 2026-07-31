"use client";
import { GraduationCap, Hash, Search, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { classifyDecision, decisionBadgeClass } from "@/lib/decision";
import { formatAverage } from "@/lib/format";
import { ResultCard, type CandidateView } from "@/components/result-card";
import { RankingsSection } from "@/components/rankings/rankings-section";
import type { FilterOptions, RankingsResponse } from "@/components/rankings/types";

type Meta = { year: number | null; notices: { ar: string; fr: string }; years: { year: number; isDefault: boolean }[]; options: FilterOptions };
type NameMatch = { candidateNumber: string; fullName: string; series: string; average: number; decision: string; wilaya: string | null; examCenter: string | null; school: string | null };

const NUMBER_SEARCH_CACHE_LIMIT = 20;

export function HomeExperience({
  dict,
  locale,
  initialMeta,
  initialRankings
}: {
  dict: Dictionary;
  locale: Locale;
  initialMeta: Meta | null;
  initialRankings: RankingsResponse | null;
}) {
  const [mode, setMode] = useState<"number" | "name">("number");
  const [number, setNumber] = useState("");
  const [year, setYear] = useState(initialMeta?.year ? String(initialMeta.year) : "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [candidate, setCandidate] = useState<CandidateView | null>(null);
  const [meta, setMeta] = useState<Meta | null>(initialMeta);

  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<NameMatch[]>([]);
  const [nameHasMore, setNameHasMore] = useState(false);
  const [nameSearching, setNameSearching] = useState(false);
  const [nameError, setNameError] = useState("");

  const inFlight = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const nameAbort = useRef<AbortController | null>(null);
  // Recent candidate-number lookups, keyed by "number:year" - repeating a search (re-typing
  // the same number, or coming back via browser navigation) shows the result instantly
  // instead of round-tripping to the API again. Bounded so it never grows unbounded in a
  // single long-lived tab.
  const numberCache = useRef<Map<string, CandidateView | null>>(new Map());

  async function openCandidate(candidateNumber: string, yearOverride?: string) {
    const useYear = yearOverride ?? year;
    const cacheKey = `${candidateNumber}:${useYear}`;
    const cached = numberCache.current.get(cacheKey);
    if (cached !== undefined) {
      inFlight.current?.abort();
      setSearchError(cached ? "" : dict.notFound);
      setCandidate(cached);
      setNumber(candidateNumber);
      setMode("number");
      const url = new URL(window.location.href);
      url.searchParams.set("number", candidateNumber);
      if (useYear) url.searchParams.set("year", useYear);
      window.history.replaceState(null, "", url);
      if (cached) requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setSearching(true);
    setSearchError("");
    setCandidate(null);
    try {
      const query = new URLSearchParams({ number: candidateNumber });
      if (useYear) query.set("year", useYear);
      const response = await fetch(`/api/public/search?${query}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) { setSearchError(dict.serviceUnavailable); return; }
      numberCache.current.set(cacheKey, data.candidate ?? null);
      if (numberCache.current.size > NUMBER_SEARCH_CACHE_LIMIT) {
        const oldest = numberCache.current.keys().next().value;
        if (oldest !== undefined) numberCache.current.delete(oldest);
      }
      if (!data.candidate) { setSearchError(dict.notFound); return; }
      setCandidate(data.candidate);
      setNumber(candidateNumber);
      setMode("number");
      const url = new URL(window.location.href);
      url.searchParams.set("number", candidateNumber);
      if (useYear) url.searchParams.set("year", useYear);
      window.history.replaceState(null, "", url);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setSearchError(dict.serviceUnavailable);
    } finally {
      if (inFlight.current === controller) setSearching(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlNumber = params.get("number");

    if (initialMeta) {
      if (urlNumber && /^\d+$/.test(urlNumber)) openCandidate(urlNumber, initialMeta.year ? String(initialMeta.year) : "");
      return;
    }

    let cancelled = false;
    fetch("/api/public/meta")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Meta) => {
        if (cancelled) return;
        setMeta(data);
        const urlYear = params.get("year");
        const resolvedYear = urlYear && data.years.some((y) => String(y.year) === urlYear) ? urlYear : (data.year ? String(data.year) : "");
        if (resolvedYear) setYear(resolvedYear);
        if (urlNumber && /^\d+$/.test(urlNumber)) openCandidate(urlNumber, resolvedYear);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search once the number is a valid candidate number and the visitor pauses typing -
  // no button click required. A real Enter/click submit (below) still runs instantly instead
  // of waiting out the debounce. A cache hit inside openCandidate resolves this immediately.
  useEffect(() => {
    if (mode !== "number") return;
    const clean = number.trim();
    if (!clean || !/^\d+$/.test(clean)) return;
    if (candidate && candidate.candidateNumber === clean) return;
    const timer = setTimeout(() => { openCandidate(clean); }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, mode, year]);

  useEffect(() => {
    const trimmed = nameQuery.trim();
    if (trimmed.length < 2) { setNameResults([]); setNameHasMore(false); setNameError(""); setNameSearching(false); return; }
    const timer = setTimeout(() => {
      nameAbort.current?.abort();
      const controller = new AbortController();
      nameAbort.current = controller;
      setNameSearching(true);
      setNameError("");
      const query = new URLSearchParams({ query: trimmed });
      if (year) query.set("year", year);
      fetch(`/api/public/search-name?${query}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data: { candidates: NameMatch[]; hasMore: boolean }) => {
          setNameResults(data.candidates);
          setNameHasMore(data.hasMore);
        })
        .catch((error) => { if ((error as { name?: string })?.name !== "AbortError") setNameError(dict.serviceUnavailable); })
        .finally(() => { if (nameAbort.current === controller) setNameSearching(false); });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameQuery, year]);

  async function submitNumber(event: FormEvent) {
    event.preventDefault();
    const clean = number.trim();
    setSearchError("");
    if (!clean) { setSearchError(dict.required); return; }
    if (!/^\d+$/.test(clean)) { setSearchError(dict.invalidNumber); return; }
    openCandidate(clean);
  }

  function reset() {
    setCandidate(null);
    setSearchError("");
    setNumber("");
    setNameQuery("");
    setNameResults([]);
    const url = new URL(window.location.href);
    url.searchParams.delete("number");
    window.history.replaceState(null, "", url);
  }

  function switchMode(next: "number" | "name") {
    setMode(next);
    setSearchError("");
    setNameError("");
  }

  return <>
    <section className="shell flex flex-col items-center pb-6 pt-14 text-center sm:pb-8 sm:pt-20">
      <span className="grid size-16 place-items-center rounded-2xl text-white" style={{ background: "var(--accent)" }}><GraduationCap size={32} /></span>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{dict.brand}</h1>
      <p className="mt-1.5 text-xs font-bold" style={{ fontFamily: "var(--font-arabic)", color: "var(--muted)" }} dir="rtl" lang="ar">{dict.designCredit}</p>
      <p className="muted mt-5 max-w-lg text-base leading-7 sm:text-lg">{dict.heroText}</p>

      {meta?.notices[locale] && <aside className="mt-8 max-w-xl rounded-xl border bg-[var(--accent-soft)] p-4 font-bold text-[var(--accent-strong)]" role="status">{meta.notices[locale]}</aside>}

      {!candidate && <div className="surface mt-10 w-full max-w-xl p-6 sm:p-8">
        {meta && meta.years.length > 1 && <div className="mb-5 flex justify-center">
          <select aria-label={dict.publishedYear} className="field !w-auto !min-h-10 !py-1" value={year} onChange={(event) => { setYear(event.target.value); setSearchError(""); }}>
            {meta.years.map((y) => <option key={y.year} value={y.year}>BAC {y.year}</option>)}
          </select>
        </div>}

        <div className="mb-5 flex justify-center gap-2" role="tablist" aria-label={dict.searchTitle}>
          <button type="button" role="tab" aria-selected={mode === "number"} className="button secondary !min-h-10 !py-2" style={mode === "number" ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined} onClick={() => switchMode("number")}><Hash size={16} />{dict.searchModeNumber}</button>
          <button type="button" role="tab" aria-selected={mode === "name"} className="button secondary !min-h-10 !py-2" style={mode === "name" ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined} onClick={() => switchMode("name")}><UserRound size={16} />{dict.searchModeName}</button>
        </div>

        {mode === "number" && <form onSubmit={submitNumber} noValidate>
          <label className="label" htmlFor="candidate-number">{dict.candidateNumber}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="candidate-number"
              className="field flex-1 text-center text-xl font-black tracking-wide sm:text-start"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={number}
              onChange={(event) => { setNumber(event.target.value); setSearchError(""); }}
              aria-describedby="search-hint search-error"
              aria-invalid={Boolean(searchError)}
              placeholder="00001"
            />
            <button className="button sm:min-w-40" disabled={searching}>
              {searching ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Search size={19} />} {searching ? dict.searching : dict.search}
            </button>
          </div>
          <p id="search-hint" className="muted mt-3 text-xs">{dict.searchHint}</p>
          {searchError && <p id="search-error" role="alert" className="mt-3 text-sm font-bold text-[var(--danger)]">{searchError}</p>}
        </form>}

        {mode === "name" && <div>
          <label className="label" htmlFor="candidate-name-search">{dict.searchModeName}</label>
          <div className="relative">
            <input
              id="candidate-name-search"
              className="field text-center sm:text-start"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder={dict.namePlaceholder}
              autoComplete="off"
            />
          </div>
          <p className="muted mt-3 text-xs">{dict.nameSearchHint}</p>
          {nameError && <p role="alert" className="mt-3 text-sm font-bold text-[var(--danger)]">{nameError}</p>}

          {nameSearching && <div className="mt-4 space-y-2">
            <div className="skeleton h-14" /><div className="skeleton h-14" />
          </div>}

          {!nameSearching && nameQuery.trim().length >= 2 && nameResults.length === 0 && !nameError && <p className="muted mt-4 text-sm">{dict.nameSearchNoResults}</p>}

          {!nameSearching && nameResults.length > 0 && <ul className="mt-4 divide-y overflow-hidden rounded-xl border text-start" style={{ borderColor: "var(--line)" }}>
            {nameResults.map((match) => {
              const known = classifyDecision(match.decision);
              const decisionLabel = known ? dict.decisions[known] : match.decision;
              return <li key={match.candidateNumber}>
                <button type="button" className="rank-row flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 text-start" onClick={() => openCandidate(match.candidateNumber)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{match.fullName}</p>
                    <p className="muted flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="flex items-center gap-1"><Hash size={11} /><bdi dir="ltr">{match.candidateNumber}</bdi></span>
                      <bdi>{match.series}</bdi>
                      {match.wilaya && <bdi>· {match.wilaya}</bdi>}
                    </p>
                  </div>
                  <span className={`badge ${decisionBadgeClass(match.decision)}`}><bdi>{decisionLabel}</bdi></span>
                  <span className="font-black tabular-nums text-[var(--accent)]" dir="ltr">{formatAverage(match.average)}</span>
                </button>
              </li>;
            })}
          </ul>}
          {nameHasMore && <p className="muted mt-3 text-xs">{dict.nameSearchMoreResults}</p>}
        </div>}
      </div>}
    </section>

    <div ref={resultRef} />
    {candidate && meta?.year && <section className="shell mb-6 sm:mb-10">
      <ResultCard candidate={candidate} dict={dict} locale={locale} year={Number(year) || meta.year} />
      <div className="mt-6 text-center"><button className="button secondary" onClick={reset}>{dict.searchAgain}</button></div>
    </section>}

    {meta?.year && <RankingsSection dict={dict} initialYear={meta.year} years={meta.years} initialOptions={meta.options} initialData={meta.year === initialMeta?.year ? initialRankings : null} onSelectCandidate={openCandidate} />}
  </>;
}
