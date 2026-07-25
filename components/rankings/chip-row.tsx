export function ChipRow({
  items,
  active,
  onSelect,
  allLabel,
  ariaLabel
}: {
  items: string[];
  active: string;
  onSelect: (value: string) => void;
  allLabel: string;
  ariaLabel: string;
}) {
  return <div className="chip-row" role="tablist" aria-label={ariaLabel}>
    <button type="button" role="tab" aria-selected={active === ""} className={`chip${active === "" ? " chip-active" : ""}`} onClick={() => onSelect("")}>{allLabel}</button>
    {items.map((item) => <button key={item} type="button" role="tab" aria-selected={active === item} className={`chip${active === item ? " chip-active" : ""}`} onClick={() => onSelect(item)}><bdi>{item}</bdi></button>)}
  </div>;
}

export function ChipRowSkeleton() {
  return <div className="chip-row" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((index) => <span key={index} className="skeleton chip-skeleton" />)}
  </div>;
}
