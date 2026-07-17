import { readFile } from "node:fs/promises";
import { importExcel } from "../lib/excel";

function counts(rows: Record<string, unknown>[], field: string) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[field] ?? "<NULL>");
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...result.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

async function main() {
  const buffer = await readFile("BAC2024.xlsx");
  const report = await importExcel(buffer);
  const rows = report.rows as unknown as Record<string, unknown>[];
  const numbers = new Set(report.rows.map((row) => row.candidateNumber));
  const averages = report.rows.map((row) => row.average);
  console.log(JSON.stringify({
    checksum: report.checksum,
    totalRows: report.totalRows,
    validRows: report.validRows,
    invalidRows: report.invalidRows,
    errors: report.errors.slice(0, 20),
    duplicates: report.rows.length - numbers.size,
    series: counts(rows, "series"),
    decisions: counts(rows, "decision"),
    unique: {
      wilayas: new Set(report.rows.map((row) => row.wilaya).filter(Boolean)).size,
      centers: new Set(report.rows.map((row) => row.examCenter).filter(Boolean)).size,
      schools: new Set(report.rows.map((row) => row.school).filter(Boolean)).size
    },
    missing: {
      wilaya: report.rows.filter((row) => !row.wilaya).length,
      center: report.rows.filter((row) => !row.examCenter).length,
      school: report.rows.filter((row) => !row.school).length,
      birthDate: report.rows.filter((row) => !row.birthDate).length,
      birthPlace: report.rows.filter((row) => !row.birthPlace).length,
      candidateType: report.rows.filter((row) => !row.candidateType).length
    },
    averages: {
      min: Math.min(...averages),
      max: Math.max(...averages),
      mean: averages.reduce((sum, value) => sum + value, 0) / averages.length
    },
    samples: report.rows.slice(0, 3)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
