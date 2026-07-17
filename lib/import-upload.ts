import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import { IMPORT_CHUNK_SIZE } from "@/lib/import-upload-config";

const MAX_CHUNKS = Math.ceil(MAX_UPLOAD_SIZE / IMPORT_CHUNK_SIZE);
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export type ImportUploadMetadata = {
  uploadId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  totalChunks: number;
  chunkIndex: number;
};

function validUploadId(value: string) {
  return /^[a-zA-Z0-9-]{20,100}$/.test(value);
}

export function validateUploadMetadata(value: ImportUploadMetadata, chunkSize: number) {
  if (!validUploadId(value.uploadId)) throw new Error("INVALID_UPLOAD_ID");
  if (!value.fileName || value.fileName.length > 255 || !value.fileName.toLowerCase().endsWith(".xlsx")) throw new Error("INVALID_FILE_TYPE");
  if (!Number.isInteger(value.fileSize) || value.fileSize <= 0 || value.fileSize > MAX_UPLOAD_SIZE) throw new Error("FILE_SIZE");
  if (!Number.isInteger(value.totalChunks) || value.totalChunks < 1 || value.totalChunks > MAX_CHUNKS) throw new Error("INVALID_UPLOAD_CHUNKS");
  if (!Number.isInteger(value.chunkIndex) || value.chunkIndex < 0 || value.chunkIndex >= value.totalChunks) throw new Error("INVALID_UPLOAD_CHUNK");
  if (chunkSize <= 0 || chunkSize > IMPORT_CHUNK_SIZE) throw new Error("INVALID_UPLOAD_CHUNK_SIZE");
  const expectedChunks = Math.ceil(value.fileSize / IMPORT_CHUNK_SIZE);
  if (expectedChunks !== value.totalChunks) throw new Error("INVALID_UPLOAD_CHUNKS");
}

export async function saveImportChunk(adminId: string, metadata: ImportUploadMetadata, data: Buffer) {
  validateUploadMetadata(metadata, data.length);
  return withDatabaseRetry(
    () => db.$transaction(async (tx) => {
      await tx.importUpload.deleteMany({
        where: { adminId, createdAt: { lt: new Date(Date.now() - UPLOAD_TTL_MS) } }
      });
      const upload = await tx.importUpload.upsert({
        where: { id: metadata.uploadId },
        create: {
          id: metadata.uploadId,
          adminId,
          fileName: metadata.fileName,
          mimeType: metadata.mimeType,
          fileSize: metadata.fileSize,
          totalChunks: metadata.totalChunks
        },
        update: {}
      });
      if (
        upload.adminId !== adminId
        || upload.fileName !== metadata.fileName
        || upload.fileSize !== metadata.fileSize
        || upload.totalChunks !== metadata.totalChunks
      ) throw new Error("UPLOAD_METADATA_MISMATCH");
      await tx.importUploadChunk.upsert({
        where: { uploadId_index: { uploadId: metadata.uploadId, index: metadata.chunkIndex } },
        create: { uploadId: metadata.uploadId, index: metadata.chunkIndex, data: Uint8Array.from(data) },
        update: { data: Uint8Array.from(data) }
      });
      return tx.importUploadChunk.count({ where: { uploadId: metadata.uploadId } });
    }, { maxWait: 10_000, timeout: 30_000 }),
    "import-upload-chunk-save",
    { maxAttempts: 3, timeoutMs: 0, baseDelayMs: 300 }
  );
}

export async function loadImportUpload(adminId: string, uploadId: string) {
  if (!validUploadId(uploadId)) throw new Error("INVALID_UPLOAD_ID");
  const upload = await withDatabaseRetry(
    () => db.importUpload.findFirst({
      where: { id: uploadId, adminId },
      include: { chunks: { orderBy: { index: "asc" } } }
    }),
    "import-upload-read",
    { maxAttempts: 3, timeoutMs: 30_000 }
  );
  if (!upload) throw new Error("UPLOAD_NOT_FOUND");
  if (upload.chunks.length !== upload.totalChunks || upload.chunks.some((chunk, index) => chunk.index !== index)) {
    throw new Error("UPLOAD_INCOMPLETE");
  }
  const buffer = Buffer.concat(upload.chunks.map((chunk) => Buffer.from(chunk.data)));
  if (buffer.length !== upload.fileSize) throw new Error("UPLOAD_SIZE_MISMATCH");
  return { buffer, fileName: upload.fileName, mimeType: upload.mimeType, uploadId: upload.id };
}

export async function deleteImportUpload(adminId: string, uploadId: string) {
  if (!validUploadId(uploadId)) return;
  await withDatabaseRetry(
    () => db.importUpload.deleteMany({ where: { id: uploadId, adminId } }),
    "import-upload-delete",
    { maxAttempts: 3, timeoutMs: 15_000 }
  );
}