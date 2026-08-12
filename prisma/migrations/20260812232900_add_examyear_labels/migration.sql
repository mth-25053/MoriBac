-- Additive only: two nullable text columns, no drops/alters/deletes. Existing
-- ExamYear rows are unaffected (labelAr/labelFr default to NULL, meaning "no
-- custom label yet" - public UI falls back to a plain "BAC {year}" string).
--
-- Verified via `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel
-- prisma/schema.prisma --script` (read-only introspection) immediately before
-- applying - this is that tool's exact, unedited output.

-- AlterTable
ALTER TABLE "ExamYear" ADD COLUMN     "labelAr" TEXT,
ADD COLUMN     "labelFr" TEXT;
