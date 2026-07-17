import { describe, expect, it } from "vitest";
import { formatAverage } from "@/lib/format";
import { DECISIONS } from "@/lib/constants";
import { dictionaries } from "@/lib/i18n";
import { candidateSearchSchema } from "@/lib/validation";

describe("localized result formatting", () => {
  it("accepts leading-zero candidate numbers without coercion", () => {
    expect(candidateSearchSchema.parse({ number: "00002" }).number).toBe("00002");
    expect(candidateSearchSchema.safeParse({ number: "00A02" }).success).toBe(false);
  });
  it("formats averages with exactly two decimals and /20", () => {
    expect(formatAverage(13.47)).toBe("13.47 /20");
    expect(formatAverage(8)).toBe("8.00 /20");
  });

  it("translates every database decision in Arabic and French", () => {
    for (const decision of DECISIONS) {
      expect(dictionaries.ar.decisions[decision]).toBeTruthy();
      expect(dictionaries.fr.decisions[decision]).toBeTruthy();
    }
    expect(dictionaries.ar.decisions.ANNULE).toBe("إلغاء الامتحان");
    expect(dictionaries.fr.decisions.ANNULE).toBe("Examen annulé");
  });
});
