import { describe, expect, it } from "vitest";
import { validateUploadMetadata } from "@/lib/import-upload";
import { IMPORT_CHUNK_SIZE } from "@/lib/import-upload-config";

function metadata(overrides: Partial<Parameters<typeof validateUploadMetadata>[0]> = {}) {
  return {
    uploadId: "12345678-1234-4234-8234-123456789012",
    fileName: "BAC-results.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 6_497_145,
    totalChunks: Math.ceil(6_497_145 / IMPORT_CHUNK_SIZE),
    chunkIndex: 0,
    ...overrides
  };
}

describe("production-safe chunked workbook uploads", () => {
  it("accepts a workbook larger than Vercel's request limit as bounded chunks", () => {
    expect(() => validateUploadMetadata(metadata(), IMPORT_CHUNK_SIZE)).not.toThrow();
  });

  it("rejects chunks larger than the configured one-megabyte boundary", () => {
    expect(() => validateUploadMetadata(metadata(), IMPORT_CHUNK_SIZE + 1)).toThrow("INVALID_UPLOAD_CHUNK_SIZE");
  });

  it("rejects incomplete or forged chunk metadata", () => {
    expect(() => validateUploadMetadata(metadata({ totalChunks: 1 }), IMPORT_CHUNK_SIZE)).toThrow("INVALID_UPLOAD_CHUNKS");
    expect(() => validateUploadMetadata(metadata({ uploadId: "not-valid" }), IMPORT_CHUNK_SIZE)).toThrow("INVALID_UPLOAD_ID");
    expect(() => validateUploadMetadata(metadata({ fileName: "BAC-results.xls" }), IMPORT_CHUNK_SIZE)).toThrow("INVALID_FILE_TYPE");
  });
});