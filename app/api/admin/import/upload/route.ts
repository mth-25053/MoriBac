import { NextResponse } from "next/server";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
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
  logRequest(id, "import-upload", "request-started", {
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
      mimeType: String(form.get("mimeType") || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      fileSize: integer(form.get("fileSize")),
      totalChunks: integer(form.get("totalChunks")),
      chunkIndex: integer(form.get("chunkIndex"))
    };
    const data = Buffer.from(await chunk.arrayBuffer());
    logRequest(id, "import-upload", "chunk-received", {
      uploadId: metadata.uploadId,
      chunkIndex: metadata.chunkIndex,
      totalChunks: metadata.totalChunks,
      chunkBytes: data.length,
      fileSize: metadata.fileSize
    });
    const receivedChunks = await saveImportChunk(auth.session.adminId, metadata, data);
    logRequest(id, "import-upload", "chunk-saved", {
      uploadId: metadata.uploadId,
      chunkIndex: metadata.chunkIndex,
      receivedChunks,
      totalChunks: metadata.totalChunks
    });
    return NextResponse.json({ ok: true, uploadId: metadata.uploadId, receivedChunks, requestId: id });
  } catch (error) {
    logRequestError(id, "import-upload", "request-failed", error);
    if (isDatabaseError(error)) return databaseUnavailable(error, "import-upload", id);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "UPLOAD_FAILED";
    return apiError(code, 422, { requestId: id });
  }
}