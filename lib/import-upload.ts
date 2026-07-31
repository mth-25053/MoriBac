import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import { IMPORT_CHUNK_SIZE } from "@/lib/import-upload-config";

type PrismaTransaction = Prisma.TransactionClient;

export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

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

const DEFAULT_ALLOWED_EXTENSIONS = [".xlsx"];

export type UploadValidationOptions = {
  /** Defaults to Excel-only so the candidate-results importer keeps its exact current behavior unchanged. */
  allowedExtensions?: string[];
  /** Defaults to MAX_UPLOAD_SIZE (the candidate-results limit). The grade importer passes MAX_GRADE_UPLOAD_SIZE instead - each import type owns its own ceiling, so widening one never affects the other. */
  maxUploadSize?: number;
};

export function validateUploadMetadata(value: ImportUploadMetadata, chunkSize: number, options: UploadValidationOptions = {}) {
  const allowedExtensions = options.allowedExtensions ?? DEFAULT_ALLOWED_EXTENSIONS;
  const maxUploadSize = options.maxUploadSize ?? MAX_UPLOAD_SIZE;
  const maxChunks = Math.ceil(maxUploadSize / IMPORT_CHUNK_SIZE);

  if (!validUploadId(value.uploadId)) throw new Error("INVALID_UPLOAD_ID");
  const lowerFileName = value.fileName.toLowerCase();
  if (!value.fileName || value.fileName.length > 255 || !allowedExtensions.some((extension) => lowerFileName.endsWith(extension))) throw new Error("INVALID_FILE_TYPE");
  if (!Number.isInteger(value.fileSize) || value.fileSize <= 0 || value.fileSize > maxUploadSize) throw new Error("FILE_SIZE");
  if (!Number.isInteger(value.totalChunks) || value.totalChunks < 1 || value.totalChunks > maxChunks) throw new Error("INVALID_UPLOAD_CHUNKS");
  if (!Number.isInteger(value.chunkIndex) || value.chunkIndex < 0 || value.chunkIndex >= value.totalChunks) throw new Error("INVALID_UPLOAD_CHUNK");
  if (chunkSize <= 0 || chunkSize > IMPORT_CHUNK_SIZE) throw new Error("INVALID_UPLOAD_CHUNK_SIZE");
  const expectedChunks = Math.ceil(value.fileSize / IMPORT_CHUNK_SIZE);
  if (expectedChunks !== value.totalChunks) throw new Error("INVALID_UPLOAD_CHUNKS");
}

export async function expireStaleUploads(tx: PrismaTransaction, adminId: string, cutoff: Date) {
  const inUse = await tx.importBatch.findMany({
    where: { adminId, status: { not: "IMPORTED" }, uploadId: { not: null } },
    select: { uploadId: true }
  });
  const protectedIds = inUse.map((batch) => batch.uploadId as string);
  await tx.importUpload.deleteMany({
    where: { adminId, createdAt: { lt: cutoff }, id: { notIn: protectedIds } }
  });
}

export async function saveImportChunk(adminId: string, metadata: ImportUploadMetadata, data: Buffer, options: UploadValidationOptions = {}) {
  validateUploadMetadata(metadata, data.length, options);
  return withDatabaseRetry(
    () => db.$transaction(async (tx) => {
      await expireStaleUploads(tx, adminId, new Date(Date.now() - UPLOAD_TTL_MS));
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

export async function persistBufferAsUpload(adminId: string, fileName: string, mimeType: string, buffer: Buffer) {
  const uploadId = randomUUID();
  const totalChunks = Math.max(1, Math.ceil(buffer.length / IMPORT_CHUNK_SIZE));
  await withDatabaseRetry(
    () => db.$transaction(async (tx) => {
      await expireStaleUploads(tx, adminId, new Date(Date.now() - UPLOAD_TTL_MS));
      await tx.importUpload.create({
        data: { id: uploadId, adminId, fileName, mimeType, fileSize: buffer.length, totalChunks }
      });
      for (let index = 0; index < totalChunks; index += 1) {
        const chunk = buffer.subarray(index * IMPORT_CHUNK_SIZE, (index + 1) * IMPORT_CHUNK_SIZE);
        await tx.importUploadChunk.create({ data: { uploadId, index, data: Uint8Array.from(chunk) } });
      }
    }, { maxWait: 10_000, timeout: 30_000 }),
    "import-upload-persist-direct",
    { maxAttempts: 3, timeoutMs: 0, baseDelayMs: 300 }
  );
  return uploadId;
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

/**
 * Runs the same stale-upload cleanup normally triggered opportunistically on the next
 * upload, but for every admin - intended for a scheduled job so cleanup doesn't depend
 * on someone happening to upload again. Per-admin failures are isolated and reported,
 * not thrown, so one bad admin's row can't stop the sweep for everyone else.
 */
export async function cleanupStaleUploadsForAllAdmins() {
  const admins = await db.admin.findMany({ select: { id: true } });
  const cutoff = new Date(Date.now() - UPLOAD_TTL_MS);
  let failures = 0;
  for (const admin of admins) {
    try {
      await withDatabaseRetry(
        () => db.$transaction((tx) => expireStaleUploads(tx, admin.id, cutoff)),
        "import-upload-cleanup-scheduled",
        { maxAttempts: 2, timeoutMs: 15_000 }
      );
    } catch {
      failures += 1;
    }
  }
  return { adminsProcessed: admins.length, failures };
}