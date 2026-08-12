-- Additive only: two nullable columns, no drops/alters/deletes. Existing
-- CandidateSubjectGrade rows (normal-session, 516,956 of them) are completely
-- unaffected - noteS1/noteS2 simply default to NULL for them, exactly as
-- intended (this detail only applies to complementary-session grades).
--
-- Verified via `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel
-- prisma/schema.prisma --script` (read-only introspection) immediately before
-- applying - this is that tool's exact, unedited output.

-- AlterTable
ALTER TABLE "CandidateSubjectGrade" ADD COLUMN     "noteS1" DECIMAL(5,2),
ADD COLUMN     "noteS2" DECIMAL(5,2);
