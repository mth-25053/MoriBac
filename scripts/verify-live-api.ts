type Candidate = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: string;
  wilaya: string | null;
  examCenter: string | null;
  school: string | null;
  birthDate?: unknown;
  birthPlace?: unknown;
};

type ResultsResponse = {
  candidates: Candidate[];
  total: number;
  pageCount: number;
  statistics: null | { total: number };
};

type YearFixture = {
  year: number;
  count: number;
  candidate: Pick<Candidate, "candidateNumber" | "fullName" | "series" | "average" | "decision">;
  center: string;
  schoolCenter: string;
  school: string;
};

const fixtures: YearFixture[] = [
  { year: 2021, count: 46_587, candidate: { candidateNumber: "00001", fullName: "[REDACTED CANDIDATE NAME]", series: "SN", average: 2.84, decision: "REDOUBLE" }, center: "Lycée Kaedi 1", schoolCenter: "Lycée Aioun", school: "Lycée Aioun" },
  { year: 2024, count: 47_217, candidate: { candidateNumber: "00002", fullName: "[REDACTED CANDIDATE NAME]", series: "LM", average: 4.8, decision: "REDOUBLE" }, center: "Lycée El Argoub Tidjikja", schoolCenter: "Lycée El Argoub Tidjikja", school: "Tidjikja" },
  { year: 2025, count: 53_148, candidate: { candidateNumber: "00002", fullName: "[REDACTED CANDIDATE NAME]", series: "M", average: 8.47, decision: "SESSIONNAIRE" }, center: "Lycée Rosso", schoolCenter: "Lycée Rosso", school: "Rosso Candidat Libre" }
];

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function getJson<T>(path: string, validate?: (value: T) => void): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120_000) });
      const body = await response.text();
      if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body}`);
      const value = JSON.parse(body) as T;
      validate?.(value);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

function resultsUrl(values: Record<string, string | number>) {
  return `/api/public/results?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))}`;
}

async function verifyBrowse(fixture: YearFixture, center: string, school?: string) {
  const first = await getJson<ResultsResponse>(resultsUrl({ year: fixture.year, center, ...(school ? { school } : {}), page: 1, sort: "highest" }));
  assert(first.total > 0, `BAC ${fixture.year} ${school ? "school" : "center"} browsing returned no candidates`);
  assert(first.candidates.length === Math.min(50, first.total), `BAC ${fixture.year} page-one size mismatch`);
  assert(first.candidates.every((row) => row.examCenter === center && (!school || row.school === school)), `BAC ${fixture.year} browse filter mismatch`);
  assert(first.statistics?.total === first.total, `BAC ${fixture.year} statistics total mismatch`);
  assert(first.pageCount === Math.ceil(first.total / 50), `BAC ${fixture.year} page count mismatch`);
  if (first.pageCount > 1) {
    const second = await getJson<ResultsResponse>(resultsUrl({ year: fixture.year, center, ...(school ? { school } : {}), page: 2, sort: "highest" }));
    assert(second.candidates.length === Math.min(50, first.total - 50), `BAC ${fixture.year} page-two size mismatch`);
    assert(!second.candidates.some((row) => first.candidates.some((firstRow) => firstRow.candidateNumber === row.candidateNumber)), `BAC ${fixture.year} pagination overlap`);
  }
  return { total: first.total, pageCount: first.pageCount };
}

async function main() {
  const summary = [];
  for (const fixture of fixtures) {
    const search = await getJson<{ candidate: Candidate | null; year: number }>(`/api/public/search?number=${fixture.candidate.candidateNumber}&year=${fixture.year}`);
    const candidate = search.candidate;
    assert(candidate && search.year === fixture.year, `BAC ${fixture.year} candidate was not returned`);
    assert(candidate.candidateNumber === fixture.candidate.candidateNumber, `BAC ${fixture.year} leading zeros were lost`);
    assert(candidate.fullName === fixture.candidate.fullName && candidate.series === fixture.candidate.series && candidate.decision === fixture.candidate.decision, `BAC ${fixture.year} candidate data mismatch`);
    assert(Math.abs(candidate.average - fixture.candidate.average) < 0.001, `BAC ${fixture.year} candidate average mismatch`);
    assert(!("birthDate" in candidate) && !("birthPlace" in candidate), `BAC ${fixture.year} public API leaked birth data`);

    const meta = await getJson<{ year: number | null; years: { year: number; isDefault: boolean }[]; options: { series: string[] } }>(`/api/public/meta?year=${fixture.year}`);
    assert(meta.year === fixture.year, `BAC ${fixture.year} is not published`);
    assert(meta.years.map((item) => item.year).join(",") === "2025,2024,2021", "Production year selector mismatch");
    assert(meta.years.find((item) => item.year === 2024)?.isDefault === true, "BAC 2024 is not the default year");

    let total = 0;
    for (const series of meta.options.series) {
      const result = await getJson<ResultsResponse>(resultsUrl({ year: fixture.year, series }));
      assert(result.candidates.length === Math.min(10, result.total), `BAC ${fixture.year} Top 10 count failed for ${series}`);
      assert(result.candidates.every((row) => row.series === series), `BAC ${fixture.year} series filter failed for ${series}`);
      assert(result.candidates.every((row, index, rows) => index === 0 || rows[index - 1].average >= row.average), `BAC ${fixture.year} Top 10 ordering failed for ${series}`);
      total += result.total;
    }
    assert(total === fixture.count, `BAC ${fixture.year} series totals expected ${fixture.count}, got ${total}`);

    const empty = await getJson<ResultsResponse>(resultsUrl({ year: fixture.year }));
    assert(empty.total === 0 && empty.candidates.length === 0, `BAC ${fixture.year} results appeared without a filter`);
    const center = await verifyBrowse(fixture, fixture.center);
    const school = await verifyBrowse(fixture, fixture.schoolCenter, fixture.school);
    summary.push({ year: fixture.year, candidates: total, series: meta.options.series.length, center, school });
  }
  console.log(JSON.stringify({ years: fixtures.map((fixture) => fixture.year), summary }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "LIVE_API_VERIFICATION_FAILED");
  process.exitCode = 1;
});