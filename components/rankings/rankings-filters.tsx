import { RotateCcw } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { ChipRow, ChipRowSkeleton } from "@/components/rankings/chip-row";
import { FilterableList } from "@/components/rankings/filterable-list";
import { WilayaSelect } from "@/components/rankings/wilaya-select";
import type { FilterOptions } from "@/components/rankings/types";

type YearOption = { year: number; isDefault: boolean };

export function RankingsFilters({
  dict,
  years,
  year,
  series,
  wilaya,
  path,
  options,
  optionsLoading,
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
  options: FilterOptions;
  optionsLoading: boolean;
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      {years.length > 1 && <label className="flex items-center gap-2">
        <span className="label !mb-0">{dict.publishedYear}</span>
        <select className="field !w-auto !min-h-10 !py-1" value={year} onChange={(event) => onYear(Number(event.target.value))}>
          {years.map((item) => <option key={item.year} value={item.year}>BAC {item.year}</option>)}
        </select>
      </label>}
      {hasActiveFilters && <button type="button" className="icon-button" onClick={onReset} aria-label={dict.resetFilters} title={dict.resetFilters}><RotateCcw size={17} /></button>}
    </div>

    <div className="mt-4">
      <span className="label">{dict.series}</span>
      {optionsLoading && options.series.length === 0 ? <ChipRowSkeleton /> : <ChipRow items={options.series} active={series} onSelect={onSeries} allLabel={dict.allSeries} ariaLabel={dict.series} />}
    </div>

    <div className="mt-4">
      <WilayaSelect dict={dict} wilaya={wilaya} wilayas={options.wilayas} loading={optionsLoading && options.wilayas.length === 0} onSelect={onWilaya} />
    </div>

    {wilaya && <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--line)" }}>
      <span className="label">{dict.choosePath}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="button secondary !min-h-12" style={path === "school" ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined} onClick={() => onPath("school")}>{dict.viewBySchool}</button>
        <button type="button" className="button secondary !min-h-12" style={path === "center" ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined} onClick={() => onPath("center")}>{dict.viewByCenter}</button>
      </div>

      {path === "school" && <div className="mt-3">
        <span className="label">{dict.school}</span>
        <FilterableList items={options.schools} value="" onSelect={onSchool} placeholder={dict.schoolSearchPlaceholder} emptyLabel={dict.noResults} />
      </div>}
      {path === "center" && <div className="mt-3">
        <span className="label">{dict.center}</span>
        <FilterableList items={options.centers} value="" onSelect={onCenter} placeholder={dict.centerSearchPlaceholder} emptyLabel={dict.noResults} />
      </div>}
    </div>}
  </div>;
}
