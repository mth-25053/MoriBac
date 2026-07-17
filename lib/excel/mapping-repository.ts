import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import { validateColumnMapping } from "@/lib/excel/excel-importer";
import type { ColumnMapping, WorkbookInspection } from "@/lib/excel/types";

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class MappingRepository {
  constructor(private readonly database = db) {}

  async find(inspection: WorkbookInspection): Promise<ColumnMapping | null> {
    const saved = await withDatabaseRetry(
      () => this.database.excelMapping.findUnique({ where: { structureKey: inspection.structureKey } }),
      "excel-mapping-read",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    if (!saved) return null;
    let mapping: ColumnMapping;
    try {
      mapping = validateColumnMapping(saved.mapping, inspection);
    } catch {
      return null;
    }
    await withDatabaseRetry(
      () => this.database.excelMapping.update({ where: { id: saved.id }, data: { lastUsedAt: new Date() } }),
      "excel-mapping-touch",
      { maxAttempts: 3, timeoutMs: 12_000 }
    );
    return mapping;
  }

  async save(inspection: WorkbookInspection, mapping: ColumnMapping) {
    const validated = validateColumnMapping(mapping, inspection);
    return withDatabaseRetry(
      () => this.database.excelMapping.upsert({
        where: { structureKey: inspection.structureKey },
        create: {
          structureKey: inspection.structureKey,
          sheetName: inspection.sheetName,
          headerRow: inspection.headerRow,
          headers: json(inspection.columns),
          mapping: json(validated)
        },
        update: {
          sheetName: inspection.sheetName,
          headerRow: inspection.headerRow,
          headers: json(inspection.columns),
          mapping: json(validated),
          lastUsedAt: new Date()
        }
      }),
      "excel-mapping-save",
      { maxAttempts: 3, timeoutMs: 15_000 }
    );
  }
}