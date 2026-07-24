"use client";
import { GraduationCap, Search } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ResultCard, type CandidateView } from "@/components/result-card";
import { RankingsSection } from "@/components/rankings/rankings-section";
import type { FilterOptions } from "@/components/rankings/types";

type Meta = { year: number | null; notices: { ar: string; fr: string }; years: { year: number; isDefault: boolean }[]; options: FilterOptions };

export function HomeExperience({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const [number, setNumber] = useState("");
  const [year, setYear] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [candidate, setCandidate] = useState<CandidateView | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const lastQuery = useRef("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/meta")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Meta) => {
        if (cancelled) return;
        setMeta(data);
        if (!year && data.year) setYear(String(data.year));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    const clean = number.trim();
    setSearchError("");
    if (!clean) { setSearchError(dict.required); return; }
    if (!/^\d+$/.test(clean)) { setSearchError(dict.invalidNumber); return; }

    const queryKey = `${clean}:${year}`;
    if (searching && lastQuery.current === queryKey) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    lastQuery.current = queryKey;

    setSearching(true);
    setCandidate(null);
    try {
      const query = new URLSearchParams({ number: clean });
      if (year) query.set("year", year);
      const response = await fetch(`/api/public/search?${query}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) setSearchError(dict.serviceUnavailable);
      else if (!data.candidate) setSearchError(dict.notFound);
      else setCandidate(data.candidate);
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setSearchError(dict.serviceUnavailable);
    } finally {
      if (inFlight.current === controller) setSearching(false);
    }
  }

  function reset() {
    setCandidate(null);
    setSearchError("");
    setNumber("");
  }

  return <>
    <section className="shell flex flex-col items-center py-14 text-center sm:py-20">
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
        <form onSubmit={search} noValidate>
          <label className="label" htmlFor="candidate-number">{dict.candidateNumber}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="candidate-number"
              className="field flex-1 text-center text-xl font-black tracking-wide sm:text-start"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
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
        </form>
      </div>}
    </section>

    {candidate && <section className="shell mb-24">
      <ResultCard candidate={candidate} dict={dict} />
      <div className="mt-6 text-center"><button className="button secondary" onClick={reset}>{dict.searchAgain}</button></div>
    </section>}

    {meta?.year && <RankingsSection dict={dict} initialYear={meta.year} years={meta.years} initialOptions={meta.options} />}
  </>;
}
