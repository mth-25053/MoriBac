import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

const COLUMNS = ["NUMBAC", "SERIE", "TYPECANDIDAT", "NOM", "DATE_NAISSANCE", "LIEU_NAISSANCE", "MoyBac", "Decision", "Wilaya", "CentreExamen", "Etablissement"] as const;
const cellText = (cell: ExcelJS.Cell) => cell.text.trim();

async function main() {
  const filePath = process.argv[2] ?? "BAC2025.xlsx";
  const bytes = await readFile(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheets = [];

  for (const sheet of workbook.worksheets) {
    const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
    const indexes = new Map(headers.map((header, index) => [header, index + 1]));
    const missing = Object.fromEntries(COLUMNS.map((column) => [column, 0]));
    const types = Object.fromEntries(COLUMNS.map((column) => [column, new Map<string, number>()]));
    const decisions = new Map<string, number>();
    const series = new Map<string, number>();
    const candidateTypes = new Map<string, number>();
    const candidateNumbers = new Map<string, number[]>();
    const uniqueWilayas = new Set<string>();
    const uniqueCenters = new Set<string>();
    const uniqueSchools = new Set<string>();
    const normalizedWilayas = new Set<string>();
    const normalizedCenters = new Set<string>();
    const normalizedSchools = new Set<string>();
    const samples: Record<string, unknown>[] = [];
    const suspiciousEncoding: { row: number; column: string; value: string }[] = [];
    let leadingZeroCount = 0, numericCandidateCount = 0, invalidCandidateCount = 0;
    let malformedAverageCount = 0, outOfRangeAverageCount = 0, zeroAverageCount = 0;
    let minAverage = Number.POSITIVE_INFINITY, maxAverage = Number.NEGATIVE_INFINITY;
    let repeatedWhitespaceValues = 0;
    let candidate00002: Record<string, unknown> | null = null;

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (!row.hasValues) continue;
      const record: Record<string, unknown> = {};
      for (const column of COLUMNS) {
        const cell = row.getCell(indexes.get(column) ?? 0);
        const value = cellText(cell);
        record[column] = value;
        const typeName = ExcelJS.ValueType[cell.type] ?? String(cell.type);
        types[column].set(typeName, (types[column].get(typeName) ?? 0) + 1);
        if (!value) missing[column]++;
        if (/\s{2,}/.test(value)) repeatedWhitespaceValues++;
        if (/[\uFFFD]|(?:Ã.|Â.|â€)/.test(value) && suspiciousEncoding.length < 25) suspiciousEncoding.push({ row: rowNumber, column, value });
      }
      const numberCell = row.getCell(indexes.get("NUMBAC") ?? 0);
      const number = cellText(numberCell);
      if (numberCell.type === ExcelJS.ValueType.Number) numericCandidateCount++;
      if (number.startsWith("0")) leadingZeroCount++;
      if (!/^\d+$/.test(number)) invalidCandidateCount++;
      const numberRows = candidateNumbers.get(number) ?? [];
      numberRows.push(rowNumber);
      candidateNumbers.set(number, numberRows);
      const decision = String(record.Decision); decisions.set(decision, (decisions.get(decision) ?? 0) + 1);
      const seriesValue = String(record.SERIE); series.set(seriesValue, (series.get(seriesValue) ?? 0) + 1);
      const candidateType = String(record.TYPECANDIDAT); candidateTypes.set(candidateType, (candidateTypes.get(candidateType) ?? 0) + 1);
      uniqueWilayas.add(String(record.Wilaya)); uniqueCenters.add(String(record.CentreExamen)); uniqueSchools.add(String(record.Etablissement));
      normalizedWilayas.add(String(record.Wilaya).replace(/\s+/g, " ").trim());
      normalizedCenters.add(String(record.CentreExamen).replace(/\s+/g, " ").trim());
      normalizedSchools.add(String(record.Etablissement).replace(/\s+/g, " ").trim());
      const averageCell = row.getCell(indexes.get("MoyBac") ?? 0);
      const average = typeof averageCell.value === "number" ? averageCell.value : Number(String(averageCell.value).replace(",", "."));
      if (!Number.isFinite(average)) malformedAverageCount++;
      else { if (average < 0 || average > 20) outOfRangeAverageCount++; if (average === 0) zeroAverageCount++; minAverage = Math.min(minAverage, average); maxAverage = Math.max(maxAverage, average); }
      const sample = { row: rowNumber, candidateNumber: number, fullName: record.NOM, series: record.SERIE, average, decision: record.Decision, wilaya: record.Wilaya, examCenter: record.CentreExamen, school: record.Etablissement };
      if (samples.length < 5) samples.push(sample);
      if (number === "00002") candidate00002 = sample;
    }
    const duplicates = [...candidateNumbers.entries()].filter(([, rows]) => rows.length > 1).map(([candidateNumber, rows]) => ({ candidateNumber, rows }));
    sheets.push({
      name: sheet.name, rowCount: sheet.rowCount, dataRowCount: sheet.actualRowCount - 1, columnCount: sheet.actualColumnCount, headers, missing,
      cellTypes: Object.fromEntries(COLUMNS.map((column) => [column, Object.fromEntries(types[column])])),
      decisions: Object.fromEntries([...decisions.entries()].sort()), series: Object.fromEntries([...series.entries()].sort()), candidateTypes: Object.fromEntries([...candidateTypes.entries()].sort()),
      candidateNumbers: { unique: candidateNumbers.size, duplicateCount: duplicates.length, duplicateSamples: duplicates.slice(0, 25), leadingZeroCount, numericCellCount: numericCandidateCount, malformedCount: invalidCandidateCount, minLength: Math.min(...[...candidateNumbers.keys()].map((value) => value.length)), maxLength: Math.max(...[...candidateNumbers.keys()].map((value) => value.length)) },
      averages: { malformedCount: malformedAverageCount, outOfRangeCount: outOfRangeAverageCount, zeroCount: zeroAverageCount, min: minAverage, max: maxAverage },
      uniqueCounts: { raw: { wilayas: uniqueWilayas.size, centers: uniqueCenters.size, schools: uniqueSchools.size }, whitespaceNormalized: { wilayas: normalizedWilayas.size, centers: normalizedCenters.size, schools: normalizedSchools.size } }, repeatedWhitespaceValues, suspiciousEncoding, samples, candidate00002
    });
  }
  console.log(JSON.stringify({ filePath, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), sheetCount: workbook.worksheets.length, sheets }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });