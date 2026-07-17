import type ExcelJS from "exceljs";

export function cellText(cell: ExcelJS.Cell) {
  if (cell.value == null) return "";
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  if (typeof cell.value === "object" && "text" in cell.value) return String(cell.value.text).trim();
  if (typeof cell.value === "object" && "result" in cell.value) return String(cell.value.result ?? "").trim();
  return cell.text.trim();
}

export function candidateNumberText(cell: ExcelJS.Cell) {
  if (typeof cell.value === "number" && /^0+$/.test(cell.numFmt)) {
    return String(Math.trunc(cell.value)).padStart(cell.numFmt.length, "0");
  }
  return cellText(cell);
}