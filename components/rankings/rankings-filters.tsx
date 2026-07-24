import { RotateCcw } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { FilterOptions } from "@/components/rankings/types";

type YearOption = { year: number; isDefault: boolean };

export function RankingsFilters({
  dict,
  years,
  year,
  series,
  wilaya,
  path,
  school,
  examCenter,
  options,
  hasActiveFilters,
  onYear,
  onSeries,
  onWilaya,
  onPath,
  onSchool,
  onCenter,
  onReset
}: {
  dict: Dictionary;
  years: YearOption[];
  year: number;
  series: string;
  wilaya: string;
  path: "school" | "center" | null;
  school: string;
  examCenter: string;
  options: FilterOptions;
  hasActiveFilters: boolean;
  onYear: (value: number) => void;
  onSeries: (value: string) => void;
  onWilaya: (value: string) => void;
  onPath: (value: "school" | "center") => void;
  onSchool: (value: string) => void;
  onCenter: (value: string) => void;
  onReset: () => void;
}) {
  return <div className="surface mt-8 p-4 sm:p-5">
    <div className="flex flex-wrap items-end gap-3">
      {years.length > 1 && <label className="min-w-28">
        <span className="label">{dict.publishedYear}</span>
        <select className="field" value={year} onChange={(event) => onYear(Number(event.target.value))}>
          {years.map((item) => <option key={item.year} value={item.year}>BAC {item.year}</option>)}
        </select>
      </label>}
      <label className="min-w-40 flex-1">
        <span className="label">{dict.series}</span>
        <select className="field" value={series} onChange={(event) => onSeries(event.target.value)}>
          <option value="">{dict.allSeries}</option>
          {options.series.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="min-w-40 flex-1">
        <span className="label">{dict.wilaya}</span>
        <select className="field" value={wilaya} onChange={(event) => onWilaya(event.target.value)}>
          <option value="">{dict.allWilayas}</option>
          {options.wilayas.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      {hasActiveFilters && <button type="button" className="icon-button" onClick={onReset} aria-label={dict.resetFilters} title={dict.resetFilters}><RotateCcw size={17} /></button>}
    </div>

    {wilaya && <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
      <span className="label">{dict.choosePath}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="button secondary" style={path === "school" ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined} onClick={() => onPath("school")}>{dict.viewBySchool}</button>
        <button type="button" className="button secondary" style={path === "center" ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined} onClick={() => onPath("center")}>{dict.viewByCenter}</button>
      </div>

      {path === "school" && <label className="mt-3 block">
        <span className="label">{dict.school}</span>
        <select className="field" value={school} onChange={(event) => onSchool(event.target.value)}>
          <option value="">{dict.selectSchool}</option>
          {options.schools.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>}
      {path === "center" && <label className="mt-3 block">
        <span className="label">{dict.center}</span>
        <select className="field" value={examCenter} onChange={(event) => onCenter(event.target.value)}>
          <option value="">{dict.selectCenter}</option>
          {options.centers.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>}
    </div>}
  </div>;
}
