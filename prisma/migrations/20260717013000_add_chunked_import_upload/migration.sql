CREATE TABLE "ImportUpload" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminId" TEXT NOT NULL,

    CONSTRAINT "ImportUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportUploadChunk" (
    "uploadId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportUploadChunk_pkey" PRIMARY KEY ("uploadId", "index")
);

CREATE INDEX "ImportUpload_adminId_createdAt_idx" ON "ImportUpload"("adminId", "createdAt");

ALTER TABLE "ImportUpload" ADD CONSTRAINT "ImportUpload_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportUploadChunk" ADD CONSTRAINT "ImportUploadChunk_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "ImportUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;