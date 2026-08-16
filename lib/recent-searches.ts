/**
 * Client-only, localStorage-backed "recent candidate searches" list. Deliberately
 * stores nothing but candidateNumber + the resolved BAC year - never a name, average,
 * decision, or any other result field - so this file must never grow into a place
 * that caches result data. See components/home-experience.tsx for how it's used and
 * lib/results-session-cache.ts for the (separate, in-memory-only) full-result cache.
 */
export type RecentSearch = { candidateNumber: string; year: string; session?: string };

const STORAGE_KEY = "mthbac:recent-searches";
const MAX_ENTRIES = 5;

function isRecentSearch(value: unknown): value is RecentSearch {
  const entry = value as Partial<RecentSearch> | null;
  return Boolean(entry) && typeof entry?.candidateNumber === "string" && typeof entry?.year === "string"
    && (entry?.session === undefined || typeof entry.session === "string");
}

export function loadRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearch).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** Adds/moves an entry to the front (deduped by number+year+session, since normal and complementary editions of the same year are different datasets) and persists. Returns the new list so the caller can update its own state without a second read. */
export function saveRecentSearch(candidateNumber: string, year: string, session?: string): RecentSearch[] {
  const current = loadRecentSearches();
  const next = [{ candidateNumber, year, session }, ...current.filter((entry) => !(entry.candidateNumber === candidateNumber && entry.year === year && entry.session === session))].slice(0, MAX_ENTRIES);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private browsing / quota - keep working from in-memory state only */ }
  }
  return next;
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
