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
  statistics: null | { total: number; passed: number; session: number; failed: number; highest: number; successRate: number };
};

type YearFixture = {
  year: number;
  count: number;
  rankableCount: number;
  // fullName is intentionally not stored here (and not compared below) so no real candidate's
  // name is embedded in tracked source; every other field is still verified against live production data.
  candidate: Pick<Candidate, "candidateNumber" | "series" | "average" | "decision">;
  cancelledCandidateNumber?: string;
  center: string;
  schoolCenter: string;
  school: string;
};

const fixtures: YearFixture[] = [
  { year: 2021, count: 46_587, rankableCount: 45_820, candidate: { candidateNumber: "00001", series: "SN", average: 2.84, decision: "REDOUBLE" }, cancelledCandidateNumber: "00009", center: "Lycée Kaedi 1", schoolCenter: "Lycée Aioun", school: "Lycée Aioun" },
  { year: 2024, count: 47_217, rankableCount: 47_217, candidate: { candidateNumber: "00002", series: "LM", average: 4.8, decision: "REDOUBLE" }, center: "Lycée El Argoub Tidjikja", schoolCenter: "Lycée El Argoub Tidjikja", school: "Tidjikja" },
  { year: 2025, count: 53_148, rankableCount: 52_813, candidate: { candidateNumber: "00002", series: "M", average: 8.47, decision: "SESSIONNAIRE" }, cancelledCandidateNumber: "00072", center: "Lycée Rosso", schoolCenter: "Lycée Rosso", school: "Rosso Candidat Libre" }
];

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120_000) });
      const body = await response.text();
      if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body}`);
      return JSON.parse(body) as T;
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
  assert(first.candidates.every((row) => row.decision !== "ANNULE"), `BAC ${fixture.year} ANNULE appeared in detailed rankings`);
  assert(first.candidates.every((row) => row.examCenter === center && (!school || row.school === school)), `BAC ${fixture.year} browse filter mismatch`);
  assert(first.statistics?.total === first.total, `BAC ${fixture.year} statistics total mismatch`);
  assert(first.pageCount === Math.ceil(first.total / 50), `BAC ${fixture.year} page count mismatch`);
  if (first.pageCount > 1) {
    const second = await getJson<ResultsResponse>(resultsUrl({ year: fixture.year, center, ...(school ? { school } : {}), page: 2, sort: "highest" }));
    assert(second.candidates.every((row) => row.decision !== "ANNULE"), `BAC ${fixture.year} ANNULE appeared on ranking page two`);
    assert(!second.candidates.some((row) => first.candidates.some((firstRow) => firstRow.candidateNumber === row.candidateNumber)), `BAC ${fixture.year} pagination overlap`);
  }
  return { total: first.total, pageCount: first.pageCount, statistics: first.statistics };
}

async function main() {
  const summary = [];
  for (const fixture of fixtures) {
    const search = await getJson<{ candidate: Candidate | null; year: number }>(`/api/public/search?number=${fixture.candidate.candidateNumber}&year=${fixture.year}`);
    const candidate = search.candidate;
    assert(candidate && search.year === fixture.year, `BAC ${fixture.year} candidate was not returned`);
    assert(candidate.candidateNumber === fixture.candidate.candidateNumber, `BAC ${fixture.year} leading zeros were lost`);
    assert(typeof candidate.fullName === "string" && candidate.fullName.length > 0, `BAC ${fixture.year} candidate is missing a full name`);
    assert(candidate.series === fixture.candidate.series && candidate.decision === fixture.candidate.decision, `BAC ${fixture.year} candidate data mismatch`);
    assert(Math.abs(candidate.average - fixture.candidate.average) < 0.001, `BAC ${fixture.year} candidate average mismatch`);
    assert(!("birthDate" in candidate) && !("birthPlace" in candidate), `BAC ${fixture.year} public API leaked birth data`);

    let cancelledCandidate: Candidate | null = null;
    if (fixture.cancelledCandidateNumber) {
      const cancelledSearch = await getJson<{ candidate: Candidate | null; year: number }>(`/api/public/search?number=${fixture.cancelledCandidateNumber}&year=${fixture.year}`);
      cancelledCandidate = cancelledSearch.candidate;
      assert(cancelledCandidate?.decision === "ANNULE", `BAC ${fixture.year} cancelled candidate is not searchable as ANNULE`);
    }

    const meta = await getJson<{ year: number | null; years: { year: number; isDefault: boolean }[]; options: { series: string[] } }>(`/api/public/meta?year=${fixture.year}`);
    assert(meta.year === fixture.year, `BAC ${fixture.year} is not published`);
    assert(meta.years.map((item) => item.year).join(",") === "2025,2024,2021", "Production year selector mismatch");
    assert(meta.years.find((item) => item.year === 2024)?.isDefault === true, "BAC 2024 is not the default year");

    let rankableTotal = 0;
    for (const series of meta.options.series) {
      const result = await getJson<ResultsResponse>(resultsUrl({ year: fixture.year, series }));
      assert(result.candidates.length === Math.min(10, result.total), `BAC ${fixture.year} Top 10 count failed for ${series}`);
      assert(result.candidates.every((row) => row.series === series && row.decision !== "ANNULE"), `BAC ${fixture.year} ANNULE appeared in Top 10 for ${series}`);
      assert(result.candidates.every((row, index, rows) => index === 0 || rows[index - 1].average >= row.average), `BAC ${fixture.year} Top 10 ordering failed for ${series}`);
      rankableTotal += result.total;
    }
    assert(rankableTotal === fixture.rankableCount, `BAC ${fixture.year} rankable totals expected ${fixture.rankableCount}, got ${rankableTotal}`);
    assert(fixture.count - rankableTotal === (fixture.year === 2021 ? 767 : fixture.year === 2025 ? 335 : 0), `BAC ${fixture.year} cancellation exclusion count mismatch`);

    const center = await verifyBrowse(fixture, fixture.center);
    const school = await verifyBrowse(fixture, fixture.schoolCenter, fixture.school);
    summary.push({ year: fixture.year, candidates: fixture.count, rankable: rankableTotal, cancelledCandidate, series: meta.options.series.length, center, school });
  }
  console.log(JSON.stringify({ years: fixtures.map((fixture) => fixture.year), summary }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "LIVE_API_VERIFICATION_FAILED");
  process.exitCode = 1;
});