import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";

export type KnownSeriesLookup = {
  findUnknown: (values: string[]) => Promise<string[]>;
};

/**
 * Purely informational registry of series values seen so far. Never blocks or
 * defers an import - series has always been free text with no allowlist, so this
 * only flags genuinely new values for the admin to notice, never rejects them.
 */
export class KnownSeriesRepository implements KnownSeriesLookup {
  constructor(private readonly database = db) {}

  async findUnknown(values: string[]): Promise<string[]> {
    if (!values.length) return [];
    const known = await withDatabaseRetry(
      () => this.database.knownSeries.findMany({ where: { code: { in: values } }, select: { code: true } }),
      "known-series-read",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    const knownSet = new Set(known.map((row) => row.code));
    return values.filter((value) => !knownSet.has(value));
  }

  async list() {
    return withDatabaseRetry(
      () => this.database.knownSeries.findMany({ orderBy: { code: "asc" } }),
      "known-series-list",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async add(code: string) {
    return withDatabaseRetry(
      () => this.database.knownSeries.upsert({ where: { code }, create: { code }, update: {} }),
      "known-series-add",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }

  async delete(code: string) {
    await withDatabaseRetry(
      () => this.database.knownSeries.delete({ where: { code } }),
      "known-series-delete",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
  }
}
