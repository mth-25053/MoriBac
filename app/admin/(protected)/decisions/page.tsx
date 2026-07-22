import { DecisionMappingsManager } from "@/components/admin/decision-mappings-manager";
import { DECISIONS, type DecisionValue } from "@/lib/constants";
import { db } from "@/lib/db";
import { adminDictionary } from "@/lib/admin-i18n";
import { getLocale } from "@/lib/i18n";

function knownDecision(value: string | null): DecisionValue | null {
  return value && (DECISIONS as readonly string[]).includes(value) ? (value as DecisionValue) : null;
}

export default async function DecisionsPage() {
  const dict = adminDictionary(await getLocale());
  const mappings = await db.decisionMapping.findMany({ orderBy: [{ decision: "asc" }, { occurrences: "desc" }] });
  const pending = mappings
    .filter((mapping) => !mapping.decision)
    .map((mapping) => ({ id: mapping.id, rawValue: mapping.rawValue, decision: knownDecision(mapping.decision), occurrences: mapping.occurrences, updatedAt: mapping.updatedAt.toISOString() }));
  const resolved = mappings
    .filter((mapping) => mapping.decision)
    .map((mapping) => ({ id: mapping.id, rawValue: mapping.rawValue, decision: knownDecision(mapping.decision), occurrences: mapping.occurrences, updatedAt: mapping.updatedAt.toISOString() }));
  return <div>
    <span className="eyebrow">{dict.unknownDecisionsNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.unknownDecisionsNav}</h1>
    <DecisionMappingsManager dict={dict} pending={pending} resolved={resolved} />
  </div>;
}
