-- Make nonessential result fields nullable and retain the official candidate category.
ALTER TABLE "Candidate"
  ALTER COLUMN "wilaya" DROP NOT NULL,
  ALTER COLUMN "examCenter" DROP NOT NULL,
  ALTER COLUMN "school" DROP NOT NULL,
  ADD COLUMN "candidateType" TEXT;

-- Persist canonical mappings by normalized workbook structure.
CREATE TABLE "ExcelMapping" (
  "id" TEXT NOT NULL,
  "structureKey" TEXT NOT NULL,
  "sheetName" TEXT NOT NULL,
  "headerRow" INTEGER NOT NULL,
  "headers" JSONB NOT NULL,
  "mapping" JSONB NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExcelMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExcelMapping_structureKey_key" ON "ExcelMapping"("structureKey");
CREATE INDEX "ExcelMapping_lastUsedAt_idx" ON "ExcelMapping"("lastUsedAt");