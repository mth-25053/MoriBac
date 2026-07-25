"use client";
import { ChevronDown, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { ChipRowSkeleton } from "@/components/rankings/chip-row";
import { FilterableList } from "@/components/rankings/filterable-list";

export function WilayaSelect({
  dict,
  wilaya,
  wilayas,
  loading,
  onSelect
}: {
  dict: Dictionary;
  wilaya: string;
  wilayas: string[];
  loading: boolean;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function choose(value: string) {
    onSelect(value);
    setOpen(false);
  }

  return <div ref={rootRef}>
    <span className="label">{dict.wilaya}</span>
    <button type="button" className="select-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className="flex min-w-0 items-center gap-2"><MapPin size={16} style={{ color: "var(--accent)" }} /><bdi className="truncate">{wilaya || dict.allWilayas}</bdi></span>
      <ChevronDown size={17} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : undefined, flexShrink: 0 }} />
    </button>

    {open && (loading ? <div className="mt-2"><ChipRowSkeleton /></div> : <div className="mt-2">
      <button type="button" className={`filter-list-item filter-list-item-standalone${wilaya === "" ? " active" : ""}`} onClick={() => choose("")}>{dict.allWilayas}</button>
      <div className="mt-2">
        <FilterableList items={wilayas} value={wilaya} onSelect={choose} placeholder={dict.wilayaSearchPlaceholder} emptyLabel={dict.noResults} />
      </div>
    </div>)}
  </div>;
}
