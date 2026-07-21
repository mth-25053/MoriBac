import { loadImportUpload, persistBufferAsUpload } from "@/lib/import-upload";

export type ImportWorkbookInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadId: string;
  source: "direct" | "chunked";
};

export async function importWorkbookInput(form: FormData, adminId: string): Promise<ImportWorkbookInput> {
  const file = form.get("file");
  if (file instanceof File) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadId = await persistBufferAsUpload(adminId, file.name, file.type, buffer);
    return {
      buffer,
      fileName: file.name,
      mimeType: file.type,
      uploadId,
      source: "direct"
    };
  }
  const uploadId = String(form.get("uploadId") || "");
  if (!uploadId) throw new Error("FILE_OR_UPLOAD_REQUIRED");
  const uploaded = await loadImportUpload(adminId, uploadId);
  return { ...uploaded, source: "chunked" };
}