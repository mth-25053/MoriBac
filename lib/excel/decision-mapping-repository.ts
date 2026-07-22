import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import type { DecisionValue } from "@/lib/constants";
import { normalizeHeader } from "@/lib/excel/header-normalizer";
import type { UnknownDecision } from "@/lib/excel/types";

export type DecisionMappingLookup = {
  findResolved: (normalizedKeys: string[]) => Promise<Map<string, string>>;
};

export class DecisionMappingRepository implements DecisionMappingLookup {
  constructor(private readonly database = db) {}

  async findResolved(normalizedKeys: string[]): Promise<Map<string, string>> {
    if (!normalizedKeys.length) return new Map();
    const rows = await withDatabaseRetry(
      () => this.database.decisionMapping.findMany({
        where: { normalizedKey: { in: normalizedKeys }, decision: { not: null } },
        select: { normalizedKey: true, decision: true }
      }),
      "decision-mapping-read",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    return new Map(rows.map((row) => [row.normalizedKey, row.decision as string]));
  }

  async recordUnknown(entries: UnknownDecision[]) {
    if (!entries.length) return;
    await withDatabaseRetry(
      () => this.database.$transaction(entries.map((entry) => this.database.decisionMapping.upsert({
        where: { normalizedKey: entry.normalizedKey },
        create: { normalizedKey: entry.normalizedKey, rawValue: entry.rawValue, occurrences: entry.count },
        update: { occurrences: { increment: entry.count } }
      }))),
      "decision-mapping-record-unknown",
      { maxAttempts: 3, timeoutMs: 15_000 }
    );
  }

  async listPending() {
    return withDatabaseRetry(
      () => this.database.decisionMapping.findMany({ where: { decision: null }, orderBy: { occurrences: "desc" } }),
      "decision-mapping-list-pending",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async listResolved() {
    return withDatabaseRetry(
      () => this.database.decisionMapping.findMany({ where: { decision: { not: null } }, orderBy: { updatedAt: "desc" } }),
      "decision-mapping-list-resolved",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async resolve(id: string, decision: DecisionValue) {
    return withDatabaseRetry(
      () => this.database.decisionMapping.update({ where: { id }, data: { decision } }),
      "decision-mapping-resolve",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async createManual(rawValue: string, decision: DecisionValue) {
    const normalizedKey = normalizeHeader(rawValue);
    return withDatabaseRetry(
      () => this.database.decisionMapping.upsert({
        where: { normalizedKey },
        create: { normalizedKey, rawValue, decision, occurrences: 0 },
        update: { rawValue, decision }
      }),
      "decision-mapping-create-manual",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async delete(id: string) {
    await withDatabaseRetry(
      () => this.database.decisionMapping.delete({ where: { id } }),
      "decision-mapping-delete",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }
}
