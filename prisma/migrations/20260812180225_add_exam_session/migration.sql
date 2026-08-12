-- Additive only: adds a new enum type and a new nullable-defaulted column,
-- and replaces the single-column unique index on ExamYear.year with a
-- composite (year, session) unique index. No table is dropped, no existing
-- column is dropped or altered, no row is deleted. Every existing ExamYear
-- row gets session = 'NORMAL' automatically via the column default, so
-- BAC 2021/2022/2024/2025/2026 (normal) are structurally unaffected.
--
-- Verified via `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel
-- prisma/schema.prisma --script` (read-only introspection) immediately before
-- applying - this is that tool's exact, unedited output.

-- CreateEnum
CREATE TYPE "ExamSession" AS ENUM ('NORMAL', 'COMPLEMENTAIRE');

-- DropIndex
DROP INDEX "ExamYear_year_key";

-- AlterTable
ALTER TABLE "ExamYear" ADD COLUMN     "session" "ExamSession" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE UNIQUE INDEX "ExamYear_year_session_key" ON "ExamYear"("year", "session");
