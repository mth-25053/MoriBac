"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ResultCard, type CandidateView } from "@/components/result-card";
import { ResultsList } from "@/components/results-list";
import { Statistics, type Stats } from "@/components/statistics";

type Meta = { year:number|null; notices:{ar:string;fr:string}; years:{year:number;isDefault:boolean}[]; options:{series:string[];wilayas:string[];centers:string[];schools:string[]} };
type Browse = { candidates:CandidateView[]; total:number; pageCount:number; statistics:Stats|null };

export function HomeExperience({ dict, locale }: { dict:Dictionary; locale:Locale }) {
  const [number,setNumber]=useState(""); const [searching,setSearching]=useState(false); const [searchError,setSearchError]=useState(""); const [candidate,setCandidate]=useState<CandidateView|null>(null);
  const [year,setYear]=useState(""); const [series,setSeries]=useState(""); const [wilaya,setWilaya]=useState(""); const [center,setCenter]=useState(""); const [school,setSchool]=useState(""); const [sort,setSort]=useState("highest"); const [page,setPage]=useState(1);
  const [meta,setMeta]=useState<Meta|null>(null); const [results,setResults]=useState<Browse|null>(null); const [loading,setLoading]=useState(true);
  const [browseError,setBrowseError]=useState(false); const [retryKey,setRetryKey]=useState(0);

  const loadMeta=useCallback(async()=>{const q=new URLSearchParams();if(year)q.set("year",year);if(series)q.set("series",series);if(wilaya)q.set("wilaya",wilaya);if(center)q.set("center",center);if(retryKey)q.set("_retry",String(retryKey));const response=await fetch(`/api/public/meta?${q}`);if(!response.ok)throw new Error("META_FAILED");const data:Meta=await response.json();setMeta(data);setBrowseError(false);if(!year&&data.year)setYear(String(data.year));},[year,series,wilaya,center,retryKey]);
  useEffect(()=>{loadMeta().catch(()=>{setMeta(null);setBrowseError(true)});},[loadMeta]);
  useEffect(()=>{if(!series){setResults(null);setLoading(false);return;}const controller=new AbortController();setLoading(true);setBrowseError(false);const q=new URLSearchParams({series,wilaya,center,school,sort,page:String(page)});if(year)q.set("year",year);fetch(`/api/public/results?${q}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error("RESULTS_FAILED");return response.json()}).then(setResults).catch(error=>{if(error.name!=="AbortError")setBrowseError(true)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort();},[year,series,wilaya,center,school,sort,page,retryKey]);

  async function search(event:FormEvent){event.preventDefault();const clean=number.trim();setSearchError("");setCandidate(null);if(!clean){setSearchError(dict.required);return;}if(!/^\d+$/.test(clean)){setSearchError(dict.invalidNumber);return;}setSearching(true);try{const q=new URLSearchParams({number:clean});if(year)q.set("year",year);const response=await fetch(`/api/public/search?${q}`);const data=await response.json();if(!response.ok)setSearchError(dict.invalidNumber);else if(!data.candidate)setSearchError(dict.notFound);else setCandidate(data.candidate);}catch{setSearchError(dict.notFound);}finally{setSearching(false);}}
  function changeSeries(v:string){setSeries(v);setWilaya("");setCenter("");setSchool("");setPage(1);} function changeWilaya(v:string){setWilaya(v);setCenter("");setSchool("");setPage(1);} function changeCenter(v:string){setCenter(v);setSchool("");setPage(1);}
  const detailed=Boolean(center||school); const title=school?dict.schoolResults:center?dict.centerResults:dict.topTen;
  return <>
    <section className="shell grid items-center gap-8 py-12 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
      <div><span className="eyebrow">{dict.heroEyebrow}</span><h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.12] sm:text-5xl lg:text-6xl">{dict.heroTitle}</h1><p className="muted mt-5 max-w-xl text-lg leading-8">{dict.heroText}</p></div>
      <div className="surface p-5 sm:p-7"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-black">{dict.searchTitle}</h2>{meta?.years.length?<select aria-label={dict.publishedYear} className="field !w-auto !min-h-10 !py-1" value={year} onChange={e=>{setYear(e.target.value);setCandidate(null)}}>{meta.years.map(y=><option key={y.year} value={y.year}>BAC {y.year}</option>)}</select>:null}</div>
        <form onSubmit={search} noValidate><label className="label" htmlFor="candidate-number">{dict.candidateNumber}</label><div className="flex flex-col gap-2 sm:flex-row"><input id="candidate-number" className="field flex-1" dir="ltr" inputMode="numeric" autoComplete="off" value={number} onChange={e=>setNumber(e.target.value)} aria-describedby="search-hint search-error" aria-invalid={Boolean(searchError)} placeholder="00001"/><button className="button sm:min-w-32" disabled={searching}>{searching?<span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white"/>:<Search size={19}/>} {searching?dict.searching:dict.search}</button></div><p id="search-hint" className="muted mt-2 text-xs">{dict.searchHint}</p>{searchError&&<p id="search-error" role="alert" className="mt-3 text-sm font-bold text-[var(--danger)]">{searchError}</p>}</form>
      </div>
    </section>
    {meta?.notices[locale]&&<aside className="shell mb-8 rounded-xl border bg-[var(--accent-soft)] p-4 font-bold text-[var(--accent-strong)]" role="status">{meta.notices[locale]}</aside>}
    {candidate&&<section className="shell mb-16"><ResultCard candidate={candidate} dict={dict}/></section>}
    <section className="border-y py-14" style={{borderColor:"var(--line)",background:"var(--surface-2)"}} id="browse"><div className="shell"><div className="mb-7"><span className="eyebrow">{dict.browseTitle}</span><h2 className="mt-2 text-3xl font-black">{dict.browseTitle}</h2></div>
      <div className="surface mb-7 p-4 sm:p-5"><div className="mb-4 flex items-center gap-2 font-black"><SlidersHorizontal size={19}/>{dict.browseTitle}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Select label={dict.series} value={series} onChange={changeSeries} options={meta?.options.series||[]} required placeholder={dict.select}/>
        <Select label={dict.wilaya} value={wilaya} onChange={changeWilaya} options={meta?.options.wilayas||[]} disabled={!series} placeholder={dict.all}/>
        <Select label={dict.center} value={center} onChange={changeCenter} options={meta?.options.centers||[]} disabled={!wilaya} placeholder={dict.all}/>
        <Select label={dict.school} value={school} onChange={v=>{setSchool(v);setPage(1)}} options={meta?.options.schools||[]} disabled={!center} placeholder={dict.all}/>
        {detailed&&<Select label={dict.sort} value={sort} onChange={v=>{setSort(v);setPage(1)}} options={["highest","lowest","name","number"]} optionLabels={[dict.highest,dict.lowest,dict.sortName,dict.sortNumber]}/>}
      </div></div>
      {browseError?<div className="surface p-10 text-center" role="alert"><p className="font-bold text-[var(--danger)]">{dict.serviceUnavailable}</p><button className="button secondary mt-5" onClick={()=>setRetryKey(key=>key+1)}>{dict.retry}</button></div>:!series?<div className="rounded-2xl border border-dashed p-10 text-center" style={{borderColor:"var(--line)"}}><p className="muted font-bold">{dict.chooseSeries}</p></div>:loading?<Loading label={dict.loading}/>:results&&<div className="space-y-5">{results.statistics&&<Statistics stats={results.statistics} dict={dict}/>}<div className="flex items-end justify-between gap-3"><h3 className="text-xl font-black">{title}</h3><span className="muted text-sm">{results.total} {dict.totalCandidates.toLowerCase()}</span></div>{results.candidates.length?<ResultsList candidates={results.candidates} dict={dict} offset={detailed?(page-1)*50:0}/>:<div className="surface p-10 text-center muted">{dict.noResults}</div>}{detailed&&results.pageCount>1&&<nav className="flex items-center justify-center gap-3" aria-label={dict.page}><button className="button secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{dict.previous}</button><span className="text-sm font-bold">{dict.page} {page} / {results.pageCount}</span><button className="button secondary" disabled={page>=results.pageCount} onClick={()=>setPage(p=>p+1)}>{dict.next}</button></nav>}</div>}
    </div></section>
  </>;
}

function Select({label,value,onChange,options,optionLabels,disabled,required,placeholder}:{label:string;value:string;onChange:(v:string)=>void;options:string[];optionLabels?:string[];disabled?:boolean;required?:boolean;placeholder?:string}){return <label className={required?"lg:col-span-2":""}><span className="label">{label}{required&&" *"}</span><select className="field" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}><option value="">{placeholder}</option>{options.map((o,i)=><option key={o} value={o}>{optionLabels?.[i]||o}</option>)}</select></label>}
function Loading({label}:{label:string}){return <div className="space-y-3" aria-live="polite" aria-label={label}>{[1,2,3].map(i=><div key={i} className="skeleton h-20"/>)}</div>}
