-- CreateEnum
-- GRADED: numeric mark from 0 to 20. EXEMPT: a valid subject row for a
-- candidate with no numeric mark (e.g. exemption from EP/Physical Education) -
-- never guessed, never conflated with a malformed or rejected row.
CREATE TYPE "GradeStatus" AS ENUM ('GRADED', 'EXEMPT');

-- AlterTable
-- mark becomes nullable (null exactly when status = EXEMPT); status defaults
-- to GRADED so this stays purely additive for anything that doesn't set it.
ALTER TABLE "CandidateSubjectGrade" ADD COLUMN     "status" "GradeStatus" NOT NULL DEFAULT 'GRADED',
ALTER COLUMN "mark" DROP NOT NULL;
