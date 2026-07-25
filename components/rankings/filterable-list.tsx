"use client";
import { Search } from "lucide-react";
import { useState } from "react";

export function FilterableList({
  items,
  value,
  onSelect,
  placeholder,
  emptyLabel
}: {
  items: string[];
  value: string;
  onSelect: (value: string) => void;
  placeholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed ? items.filter((item) => item.toLowerCase().includes(trimmed)) : items;

  return <div>
    {items.length > 8 && <div className="relative mb-2">
      <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3" style={{ color: "var(--muted)" }} />
      <input className="field has-icon" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} autoComplete="off" />
    </div>}
    <div className="filter-list" role="listbox">
      {filtered.length === 0 && <p className="muted p-3 text-sm">{emptyLabel}</p>}
      {filtered.map((item) => <button key={item} type="button" role="option" aria-selected={value === item} className={`filter-list-item${value === item ? " active" : ""}`} onClick={() => onSelect(item)}><bdi>{item}</bdi></button>)}
    </div>
  </div>;
}
