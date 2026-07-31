// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SubjectGradesSection } from "@/components/subject-grades-section";
import { dictionaries } from "@/lib/i18n";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SubjectGradesSection", () => {
  it("does not call the grades API before the button is clicked", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the Arabic button label in the Arabic locale", () => {
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    expect(screen.getByText("عرض درجات المواد")).toBeTruthy();
  });

  it("shows the French button label in the French locale", () => {
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.fr} locale="fr" />);
    expect(screen.getByText("Voir les notes par matière")).toBeTruthy();
  });

  it("shows a loading state immediately after clicking, before the request resolves", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.spyOn(global, "fetch").mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }) as unknown as Promise<Response>);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    expect(await screen.findByText(dictionaries.ar.subjectGradesLoading)).toBeTruthy();
    resolveFetch({ ok: true, json: async () => ({ grades: [] }) });
  });

  it("displays the localized subject name, mark out of 20, and coefficient after a successful load", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ grades: [{ subjectCode: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 5, mark: 15.5, status: "GRADED", displayOrder: 1 }] })
    } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    expect(await screen.findByText("الرياضيات")).toBeTruthy();
    expect(screen.getByText("15.50 /20")).toBeTruthy();
    expect(screen.getByText("×5")).toBeTruthy();
  });

  it("shows معفى (not \"null /20\") for an EXEMPT subject in the Arabic locale", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ grades: [{ subjectCode: "EP", nameAr: "التربية البدنية", nameFr: "Éducation physique", coefficient: 1, mark: null, status: "EXEMPT", displayOrder: 8 }] })
    } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    expect(await screen.findByText("معفى")).toBeTruthy();
    expect(screen.queryByText(/null/i)).toBeNull();
    expect(screen.queryByText(/\/20/)).toBeNull();
  });

  it("shows Dispensé (not \"null /20\") for an EXEMPT subject in the French locale", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ grades: [{ subjectCode: "EP", nameAr: "التربية البدنية", nameFr: "Éducation physique", coefficient: 1, mark: null, status: "EXEMPT", displayOrder: 8 }] })
    } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.fr} locale="fr" />);
    fireEvent.click(screen.getByText("Voir les notes par matière"));
    expect(await screen.findByText("Dispensé")).toBeTruthy();
    expect(screen.queryByText(/null/i)).toBeNull();
    expect(screen.queryByText(/\/20/)).toBeNull();
  });

  it("shows a distinct 'no grades available' message (not the error message) when the API returns an empty list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ grades: [] }) } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    expect(await screen.findByText(dictionaries.ar.subjectGradesUnavailable)).toBeTruthy();
    expect(screen.queryByText(dictionaries.ar.subjectGradesError)).toBeNull();
  });

  it("shows a distinct error message (not the empty-grades message) when the request fails, with a retry action", async () => {
    expect(dictionaries.ar.subjectGradesError).not.toBe(dictionaries.ar.subjectGradesUnavailable);
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    expect(await screen.findByText(dictionaries.ar.subjectGradesError)).toBeTruthy();
    expect(screen.queryByText(dictionaries.ar.subjectGradesUnavailable)).toBeNull();
    expect(screen.getByText(dictionaries.ar.retry)).toBeTruthy();
  });

  it("retries the request when the retry button is clicked after a failure, and succeeds on the second attempt", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ grades: [{ subjectCode: "MT", nameAr: "الرياضيات", nameFr: null, coefficient: null, mark: 10, status: "GRADED", displayOrder: 1 }] })
      } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    await screen.findByText(dictionaries.ar.subjectGradesError);
    fireEvent.click(screen.getByText(dictionaries.ar.retry));
    expect(await screen.findByText("الرياضيات")).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves a zero-padded candidate number in the request query", () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ grades: [] }) } as Response);
    render(<SubjectGradesSection candidateNumber="00215" year={2026} dict={dictionaries.ar} locale="ar" />);
    fireEvent.click(screen.getByText("عرض درجات المواد"));
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(new URL(calledUrl, "https://example.test").searchParams.get("number")).toBe("00215");
  });
});
