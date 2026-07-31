import { describe, expect, it } from "vitest";
import { MAX_GRADE_UPLOAD_SIZE, MAX_UPLOAD_SIZE } from "@/lib/constants";
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

describe("configurable allowed extensions (shared with the grade importer)", () => {
  it("still rejects a non-.xlsx file when no options are passed, unchanged from before", () => {
    expect(() => validateUploadMetadata(metadata({ fileName: "grades-2026.json" }), IMPORT_CHUNK_SIZE)).toThrow("INVALID_FILE_TYPE");
  });

  it("accepts a .json file when the caller passes a wider allowlist", () => {
    expect(() => validateUploadMetadata(metadata({ fileName: "grades-2026.json" }), IMPORT_CHUNK_SIZE, { allowedExtensions: [".json", ".csv", ".xlsx"] })).not.toThrow();
  });

  it("accepts a .csv file when the caller passes a wider allowlist", () => {
    expect(() => validateUploadMetadata(metadata({ fileName: "grades-2026.csv" }), IMPORT_CHUNK_SIZE, { allowedExtensions: [".json", ".csv", ".xlsx"] })).not.toThrow();
  });

  it("still rejects an extension outside the passed allowlist", () => {
    expect(() => validateUploadMetadata(metadata({ fileName: "grades-2026.txt" }), IMPORT_CHUNK_SIZE, { allowedExtensions: [".json", ".csv", ".xlsx"] })).toThrow("INVALID_FILE_TYPE");
  });

  it("still accepts a plain .xlsx upload with the default allowlist, byte-for-byte unchanged", () => {
    expect(() => validateUploadMetadata(metadata(), IMPORT_CHUNK_SIZE)).not.toThrow();
  });
});

describe("configurable max upload size (per import type, not global)", () => {
  const oversizedForCandidates = MAX_UPLOAD_SIZE + 1;

  it("rejects a file over the default (candidate-results) size limit when no options are passed, unchanged from before", () => {
    expect(() =>
      validateUploadMetadata(metadata({ fileName: "grades-2026.xlsx", fileSize: oversizedForCandidates, totalChunks: Math.ceil(oversizedForCandidates / IMPORT_CHUNK_SIZE) }), IMPORT_CHUNK_SIZE)
    ).toThrow("FILE_SIZE");
  });

  it("accepts a file over the candidate-results limit but under the grade limit, when maxUploadSize is raised for the grade importer", () => {
    const size = MAX_UPLOAD_SIZE + 1;
    expect(() =>
      validateUploadMetadata(
        metadata({ fileName: "grades-2026.json", fileSize: size, totalChunks: Math.ceil(size / IMPORT_CHUNK_SIZE) }),
        IMPORT_CHUNK_SIZE,
        { allowedExtensions: [".json"], maxUploadSize: MAX_GRADE_UPLOAD_SIZE }
      )
    ).not.toThrow();
  });

  it("still rejects a file over the raised grade limit itself", () => {
    const size = MAX_GRADE_UPLOAD_SIZE + 1;
    expect(() =>
      validateUploadMetadata(
        metadata({ fileName: "grades-2026.json", fileSize: size, totalChunks: Math.ceil(size / IMPORT_CHUNK_SIZE) }),
        IMPORT_CHUNK_SIZE,
        { allowedExtensions: [".json"], maxUploadSize: MAX_GRADE_UPLOAD_SIZE }
      )
    ).toThrow("FILE_SIZE");
  });

  it("keeps the candidate-results limit unaffected by the grade importer's larger limit existing", () => {
    expect(MAX_GRADE_UPLOAD_SIZE).toBeGreaterThan(MAX_UPLOAD_SIZE);
    expect(() => validateUploadMetadata(metadata(), IMPORT_CHUNK_SIZE)).not.toThrow();
  });
});