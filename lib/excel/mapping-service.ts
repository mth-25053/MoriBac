import { missingRequiredFields, validateColumnMapping } from "@/lib/excel/excel-importer";
import { MappingRepository } from "@/lib/excel/mapping-repository";
import type { ColumnMapping, WorkbookInspection } from "@/lib/excel/types";

export type MappingSource = "manual" | "saved" | "automatic";
export type MappingReader = { find: (inspection: WorkbookInspection) => Promise<ColumnMapping | null> };

export async function resolveMapping(
  inspection: WorkbookInspection,
  provided: ColumnMapping | null,
  repository: MappingReader = new MappingRepository()
) {
  if (provided) {
    const mapping = validateColumnMapping(provided, inspection);
    return { mapping, source: "manual" as const, missing: missingRequiredFields(mapping) };
  }
  const saved = await repository.find(inspection);
  if (saved) return { mapping: saved, source: "saved" as const, missing: missingRequiredFields(saved) };
  const mapping = validateColumnMapping(inspection.suggestedMapping, inspection);
  return { mapping, source: "automatic" as const, missing: missingRequiredFields(mapping) };
}