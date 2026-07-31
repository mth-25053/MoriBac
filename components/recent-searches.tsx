"use client";
import { History, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { RecentSearch } from "@/lib/recent-searches";

export function RecentSearches({
  dict,
  items,
  onSelect,
  onClear
}: {
  dict: Dictionary;
  items: RecentSearch[];
  onSelect: (candidateNumber: string, year: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;

  return <div className="mt-4 text-start">
    <div className="flex items-center justify-between gap-2">
      <span className="muted flex items-center gap-1.5 text-xs font-bold"><History size={13} />{dict.recentSearches}</span>
      <button type="button" onClick={onClear} className="muted flex items-center gap-1 text-xs font-bold transition-colors hover:text-[var(--danger)]">
        <X size={12} />{dict.clearRecentSearches}
      </button>
    </div>
    <div className="chip-row mt-2" role="list" aria-label={dict.recentSearches}>
      {items.map((item) => <button
        key={`${item.candidateNumber}:${item.year}`}
        type="button"
        role="listitem"
        className="chip"
        onClick={() => onSelect(item.candidateNumber, item.year)}
      >
        <bdi dir="ltr">{item.candidateNumber}</bdi><span className="opacity-70"> · {item.year}</span>
      </button>)}
    </div>
  </div>;
}
