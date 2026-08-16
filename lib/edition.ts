/**
 * `year` alone stopped being a safe public edition identifier the moment more
 * than one session for the same year can be published at once (e.g. BAC 2026
 * normal + complementary simultaneously) - every piece of client state/URL/
 * cache that used to carry a bare year string now carries this composite
 * "{year}:{session}" key instead, parsed back into the two real params every
 * public API call actually needs. Shared by every client component with its
 * own year/edition selector (home search, rankings filters, roster pages).
 */
export function editionKey(year: number | string | null | undefined, session: string | null | undefined) {
  return year ? `${year}:${session ?? ""}` : "";
}

export function parseEditionKey(key: string): { year: string; session: string } {
  const [year = "", session = ""] = key.split(":");
  return { year, session };
}
