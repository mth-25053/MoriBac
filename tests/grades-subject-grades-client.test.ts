import { describe, expect, it, vi } from "vitest";
import { fetchSubjectGrades, subjectDisplayName } from "@/lib/grades/subject-grades-client";

function fakeFetch(response: { ok: boolean; json?: unknown; jsonThrows?: boolean }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => {
      if (response.jsonThrows) throw new Error("bad json");
      return response.json;
    }
  }) as unknown as typeof fetch;
}

describe("fetchSubjectGrades", () => {
  it("returns a loaded state with the grades, ordered as received from the API", async () => {
    const grades = [
      { subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 5, mark: 15.5, status: "GRADED", displayOrder: 1 },
      { subjectCode: "AR", nameAr: "اللغة العربية", nameFr: "Arabe", coefficient: 3, mark: 12, status: "GRADED", displayOrder: 2 }
    ];
    const result = await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, fakeFetch({ ok: true, json: { grades } }));
    expect(result).toEqual({ status: "loaded", grades });
  });

  it("passes an EXEMPT grade (null mark) through unchanged", async () => {
    const grades = [{ subjectCode: "EP", nameAr: "التربية البدنية", nameFr: "Éducation physique", coefficient: 1, mark: null, status: "EXEMPT", displayOrder: 8 }];
    const result = await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, fakeFetch({ ok: true, json: { grades } }));
    expect(result).toEqual({ status: "loaded", grades });
  });

  it("returns an empty state (not an error) when the API returns zero grades", async () => {
    const result = await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, fakeFetch({ ok: true, json: { grades: [] } }));
    expect(result).toEqual({ status: "empty" });
  });

  it("returns an error state on a non-ok HTTP response", async () => {
    const result = await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, fakeFetch({ ok: false }));
    expect(result).toEqual({ status: "error" });
  });

  it("returns an error state (not empty) when the response body is malformed", async () => {
    const result = await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, fakeFetch({ ok: true, jsonThrows: true }));
    expect(result).toEqual({ status: "error" });
  });

  it("returns an error state when the fetch itself throws (network failure)", async () => {
    const throwingFetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, throwingFetch);
    expect(result).toEqual({ status: "error" });
  });

  it("passes the candidate number through the request URL unchanged, including leading zeros", async () => {
    const fetchImpl = fakeFetch({ ok: true, json: { grades: [] } });
    await fetchSubjectGrades({ year: 2026, candidateNumber: "00215" }, fetchImpl);
    const calledUrl = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const params = new URL(calledUrl, "https://example.test").searchParams;
    expect(params.get("number")).toBe("00215");
    expect(params.get("year")).toBe("2026");
  });
});

describe("subjectDisplayName", () => {
  it("prefers the Arabic name in the Arabic locale", () => {
    expect(subjectDisplayName({ subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques" }, "ar")).toBe("الرياضيات");
  });

  it("prefers the French name in the French locale", () => {
    expect(subjectDisplayName({ subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques" }, "fr")).toBe("Mathématiques");
  });

  it("falls back to the other locale's name when the current locale's name is missing", () => {
    expect(subjectDisplayName({ subjectCode: "MT", nameAr: null, nameFr: "Mathématiques" }, "ar")).toBe("Mathématiques");
  });

  it("falls back to the raw subject code only when both localized names are missing", () => {
    expect(subjectDisplayName({ subjectCode: "MT", nameAr: null, nameFr: null }, "ar")).toBe("MT");
  });
});
