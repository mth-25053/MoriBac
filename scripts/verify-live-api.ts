type Candidate = {
  candidateNumber: string;
  fullName: string;
  series: string;
  average: number;
  decision: string;
  wilaya: string;
  examCenter: string;
  school: string;
  birthDate?: unknown;
  birthPlace?: unknown;
};

type ResultsResponse = {
  candidates: Candidate[];
  total: number;
  pageCount: number;
  statistics: null | { total: number };
};

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${base}${path}`);
      const body = await response.text();
      if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body}`);
      return JSON.parse(body) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
  throw lastError;
}

function resultsUrl(values: Record<string, string | number>) {
  return `/api/public/results?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))}`;
}

async function main() {
  const search = await getJson<{ candidate: Candidate | null; year: number }>("/api/public/search?number=00002&year=2025");
  const candidate = search.candidate;
  assert(candidate, "Candidate 00002 was not returned");
  assert(candidate.candidateNumber === "00002", "Candidate number lost its leading zeros");
  assert(candidate.fullName === "[REDACTED CANDIDATE NAME]", "Candidate 00002 name mismatch");
  assert(candidate.series === "M" && candidate.decision === "SESSIONNAIRE", "Candidate 00002 result mismatch");
  assert(Math.abs(candidate.average - 8.47) < 0.001, "Candidate 00002 average mismatch");
  assert(!("birthDate" in candidate) && !("birthPlace" in candidate), "Public API leaked birth data");
  console.log(`CANDIDATE_00002_OK average=${candidate.average}`);

  const meta = await getJson<{ year: number | null; options: { series: string[] } }>("/api/public/meta?year=2025");
  assert(meta.year === 2025, "BAC 2025 is not published");
  assert(meta.options.series.length === 7, `Expected 7 series, got ${meta.options.series.length}`);

  for (const series of meta.options.series) {
    const result = await getJson<ResultsResponse>(resultsUrl({ year: 2025, series }));
    assert(result.candidates.length === Math.min(10, result.total), `Top 10 count failed for ${series}`);
    assert(result.candidates.every((row) => row.series === series), `Series filter failed for ${series}`);
    assert(result.candidates.every((row, index, rows) => index === 0 || rows[index - 1].average >= row.average), `Top 10 ordering failed for ${series}`);
    console.log(`TOP10_OK series=${series} rows=${result.candidates.length} total=${result.total}`);
  }

  const empty = await getJson<ResultsResponse>(resultsUrl({ year: 2025 }));
  assert(empty.total === 0 && empty.candidates.length === 0, "Results appeared without a selected series");

  const center = await getJson<ResultsResponse>(resultsUrl({
    year: 2025,
    series: "NON_EXISTENT",
    wilaya: candidate.wilaya,
    center: candidate.examCenter,
    page: 1,
    sort: "highest"
  }));
  assert(center.total > 0, "Center browsing returned no candidates");
  assert(center.candidates.length === Math.min(50, center.total), "Center pagination failed");
  assert(center.candidates.every((row) => row.examCenter === candidate.examCenter), "Center browsing returned another center");
  assert(center.statistics?.total === center.total, "Center statistics total mismatch");
  assert(center.pageCount === Math.ceil(center.total / 50), "Center page count mismatch");
  console.log(`CENTER_OK total=${center.total} pageRows=${center.candidates.length} seriesIgnored=true`);

  const school = await getJson<ResultsResponse>(resultsUrl({
    year: 2025,
    series: "NON_EXISTENT",
    wilaya: candidate.wilaya,
    center: candidate.examCenter,
    school: candidate.school,
    page: 1,
    sort: "highest"
  }));
  assert(school.total > 0, "School browsing returned no candidates");
  assert(school.candidates.length === Math.min(50, school.total), "School pagination failed");
  assert(school.candidates.every((row) => row.school === candidate.school), "School browsing returned another school");
  assert(school.statistics?.total === school.total, "School statistics total mismatch");
  assert(school.pageCount === Math.ceil(school.total / 50), "School page count mismatch");
  console.log(`SCHOOL_OK total=${school.total} pageRows=${school.candidates.length} seriesIgnored=true`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "LIVE_API_VERIFICATION_FAILED");
  process.exitCode = 1;
});