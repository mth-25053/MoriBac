import { NextResponse } from "next/server";
import { MAX_GRADE_UPLOAD_SIZE } from "@/lib/constants";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { GRADE_FILE_EXTENSIONS } from "@/lib/grades/source-file";
import { authorizeMutation, apiError } from "@/lib/http";
import { saveImportChunk, type ImportUploadMetadata } from "@/lib/import-upload";
import { logRequest, logRequestError, requestId } from "@/lib/request-log";

export const runtime = "nodejs";
export const maxDuration = 60;

function integer(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export async function POST(request: Request) {
  const id = requestId(request);
  logRequest(id, "grade-import-upload", "request-started", {
    contentLength: request.headers.get("content-length"),
    contentType: request.headers.get("content-type")
  });
  const auth = await authorizeMutation(request, id);
  if ("error" in auth) return auth.error;

  try {
    const form = await request.formData();
    const chunk = form.get("chunk");
    if (!(chunk instanceof File)) return apiError("UPLOAD_CHUNK_REQUIRED", 400, { requestId: id });
    const metadata: ImportUploadMetadata = {
      uploadId: String(form.get("uploadId") || ""),
      fileName: String(form.get("fileName") || ""),
      mimeType: String(form.get("mimeType") || "application/json"),
      fileSize: integer(form.get("fileSize")),
      totalChunks: integer(form.get("totalChunks")),
      chunkIndex: integer(form.get("chunkIndex"))
    };
    const data = Buffer.from(await chunk.arrayBuffer());
    logRequest(id, "grade-import-upload", "chunk-received", {
      uploadId: metadata.uploadId,
      chunkIndex: metadata.chunkIndex,
      totalChunks: metadata.totalChunks,
      chunkBytes: data.length,
      fileSize: metadata.fileSize
    });
    const receivedChunks = await saveImportChunk(auth.session.adminId, metadata, data, {
      allowedExtensions: GRADE_FILE_EXTENSIONS,
      maxUploadSize: MAX_GRADE_UPLOAD_SIZE
    });
    logRequest(id, "grade-import-upload", "chunk-saved", {
      uploadId: metadata.uploadId,
      chunkIndex: metadata.chunkIndex,
      receivedChunks,
      totalChunks: metadata.totalChunks
    });
    return NextResponse.json({ ok: true, uploadId: metadata.uploadId, receivedChunks, requestId: id });
  } catch (error) {
    logRequestError(id, "grade-import-upload", "request-failed", error);
    if (isDatabaseError(error)) return databaseUnavailable(error, "grade-import-upload", id);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "UPLOAD_FAILED";
    return apiError(code, 422, { requestId: id });
  }
}
