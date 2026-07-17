import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

async function main() {
  const buffer = await readFile("BAC2024.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const decisions = new Map<string, number>();
  const series = new Map<string, number>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (!row.hasValues) continue;
    for (const [column, target] of [[19, decisions], [9, series]] as const) {
      const value = row.getCell(column).text.trim();
      target.set(value, (target.get(value) ?? 0) + 1);
    }
  }
  console.log(JSON.stringify({
    decisions: Object.fromEntries([...decisions.entries()].sort()),
    series: Object.fromEntries([...series.entries()].sort())
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
