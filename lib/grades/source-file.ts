import { MAX_GRADE_UPLOAD_SIZE } from "@/lib/constants";

const EXTENSION_TO_SOURCE_TYPE = {
  ".json": "JSON",
  ".csv": "CSV",
  ".xlsx": "EXCEL"
} as const;

export const GRADE_FILE_EXTENSIONS = Object.keys(EXTENSION_TO_SOURCE_TYPE);

export function detectSourceType(fileName: string) {
  const lower = fileName.toLowerCase();
  const match = (Object.keys(EXTENSION_TO_SOURCE_TYPE) as (keyof typeof EXTENSION_TO_SOURCE_TYPE)[]).find((extension) => lower.endsWith(extension));
  if (!match) throw new Error("INVALID_FILE_TYPE");
  return EXTENSION_TO_SOURCE_TYPE[match];
}

/** Extension + size only - grade files (JSON/CSV) have no fixed binary signature like XLSX's magic bytes to check. */
export function validateGradeFile(buffer: Buffer, fileName: string) {
  detectSourceType(fileName);
  if (!buffer.length || buffer.length > MAX_GRADE_UPLOAD_SIZE) throw new Error("FILE_SIZE");
}
