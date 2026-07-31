# Subject Grades — Architecture Document

Status: Phase 1 (schema) complete and approved, not yet applied to any database.
Scope: five new tables, two new enums, additive only — no existing table, column, or relation was changed.
Source: [prisma/schema.prisma](../prisma/schema.prisma), migration [20260730161313_add_subject_grades](../prisma/migrations/20260730161313_add_subject_grades/migration.sql).

---

## 1–6. New models: fields, purpose, relations, constraints, indexes

### `GradeSourceMapping`

Reusable, saved field-mapping for a given shape of incoming grade file — the mechanism that keeps this system independent of any one data source (Najahi or otherwise).

| Field | Type | Purpose |
|---|---|---|
| `id` | `String @id` | Primary key |
| `sourceType` | `GradeImportSourceType` | Which kind of file this mapping applies to (JSON / CSV / EXCEL) — a mapping saved for a JSON shape is never reused for a CSV shape, even if the field names coincide |
| `structureKey` | `String` | A fingerprint of the source's own field names (e.g. sorted JSON object keys, or a CSV header row) — the same idea as the existing `ExcelMapping.structureKey`, generalized to all three source types |
| `fieldMapping` | `Json` | The actual mapping: which source field/column corresponds to `examYear`, `examType`, `candidateNumber`, `series`, `subjectCode`, `mark` |
| `lastUsedAt` | `DateTime` | Bumped each time the mapping is reused, so stale/abandoned mappings can be told apart from active ones |
| `createdAt` | `DateTime` | Audit timestamp |

- **Relations**: none — intentionally standalone. It's read by the importer at normalization time, never joined against candidate/grade data.
- **Unique constraint**: `@@unique([sourceType, structureKey])` — one saved mapping per distinct file shape per source type; re-uploading a file with the same shape reuses the existing mapping instead of asking again.
- **Indexes**: none beyond the unique constraint (small table, looked up only by its unique key).

### `SubjectScheme`

One **immutable** subject definition per exam year, exam type, series, and subject code — the curriculum reference data everything else hangs off.

| Field | Type | Purpose |
|---|---|---|
| `id` | `String @id` | Primary key |
| `examYearId` | `String` | Which exam year this definition belongs to — the primary versioning axis (a curriculum change between years is simply a different `examYearId`, no other mechanism needed) |
| `examType` | `String @default("bac")` | Distinguishes exam types (bac, and room for bepc/concours later) without touching `ExamYear`, which stays year-only as today |
| `series` | `String` | The series this subject applies to (e.g. `SN`, `LO`, `TM`) |
| `subjectCode` | `String` | The short subject code as used by the source data (e.g. `MT`, `AR`, `PC`) |
| `nameAr` | `String?` | Arabic display name — nullable because it may be genuinely unresolved until an admin maps it (never guessed) |
| `nameFr` | `String?` | French display name — same reasoning |
| `coefficient` | `Decimal(4,2)?` | The subject's weighting coefficient — nullable for the same reason |
| `displayOrder` | `Int` | Curriculum-defined ordering for rendering the subject list, independent of alphabetical subject-code order |
| `createdAt` / `updatedAt` | `DateTime` | Audit timestamps |

- **Relations**: `examYear` (many-to-one, `onDelete: Cascade` — matches how `Candidate`/`ImportBatch` already cascade from `ExamYear`); `grades` (one-to-many back-reference from `CandidateSubjectGrade`).
- **Unique constraint**: `@@unique([examYearId, examType, series, subjectCode])` — exactly one definition per code per year/type/series; this is what makes the row immutable in practice (there is no second row to disambiguate against — a correction requires an explicit follow-up migration, by design, per your instruction to skip versioning in this release).
- **Index**: `@@index([examYearId, examType, series])` — supports "list all subjects for this year/series" (used when populating the mapping UI and when validating a candidate's subject set during import), as a prefix of the unique index.

### `CandidateSubjectGrade`

One mark for one candidate in one subject — the actual grade data.

| Field | Type | Purpose |
|---|---|---|
| `id` | `String @id` | Primary key |
| `candidateId` | `String` | Which candidate this grade belongs to |
| `subjectSchemeId` | `String` | Which subject definition this mark is for — resolving name/coefficient/order always goes through this, never duplicated onto this row |
| `mark` | `Decimal(5,2)` | The grade itself |
| `sourceBatchId` | `String?` | Which `GradeImportBatch` wrote this row — nullable traceability, not a data-integrity requirement |
| `createdAt` / `updatedAt` | `DateTime` | Audit timestamps |

- **Relations**: `candidate` (many-to-one, `onDelete: Cascade` — deleting a candidate cleans up their grades, matching how a candidate's other data is owned); `subjectScheme` (many-to-one, `onDelete: Restrict` — a scheme row can never be deleted while a grade still references it, protecting historical data integrity); `sourceBatch` (many-to-one, optional, `onDelete: SetNull` — deleting/losing a batch record never blocks or cascades into deleting grades, it just loses the traceability pointer).
- **Unique constraint**: `@@unique([candidateId, subjectSchemeId])` — one mark per candidate per subject; this is also what makes re-running an import safe (`skipDuplicates` on this key).
- **Index**: `@@index([sourceBatchId])` — supports batch rollback's `DELETE ... WHERE sourceBatchId = :id`.

Note: there is no database-level check that a grade's `subjectScheme` belongs to the *same* exam year/series as the *candidate* it's attached to — Postgres can't express a constraint across two other tables' columns without a trigger, and this codebase doesn't use triggers anywhere else. That check is enforced in application code (the importer's matching step), the same way "series mismatch" is already a reported, blocking validation category rather than a schema-level guarantee.

### `GradeImportBatch`

Tracks one grade-file import end to end — the grade-data equivalent of `ImportBatch`, kept as a fully separate table family.

| Field | Type | Purpose |
|---|---|---|
| `id` | `String @id` | Primary key |
| `sourceFileName` | `String` | Original uploaded file name, for the admin history view |
| `sourceType` | `GradeImportSourceType` | JSON / CSV / EXCEL |
| `examYearId` | `String` | Which exam year this batch is importing into |
| `examType` | `String @default("bac")` | Which exam type, mirrors `SubjectScheme.examType` |
| `checksum` | `String @unique` | Content hash of the uploaded file — the guard against re-importing the same file twice by accident |
| `status` | `GradeImportStatus` | `UPLOADED → VALIDATING → VALIDATED → IMPORTING → IMPORTED`, or `FAILED` / `ROLLED_BACK` |
| `totalRows` | `Int` | Row count in the source |
| `validatedRows` | `Int @default(0)` | Rows that passed dry-run validation |
| `importedRows` | `Int @default(0)` | Rows actually written |
| `rejectedRows` | `Int @default(0)` | Rows excluded (unmatched candidate, series mismatch, malformed mark, etc.) |
| `progressRows` | `Int @default(0)` | Resume cursor — same role as `ImportBatch.rowsImported` |
| `failureReason` | `String?` | Populated on `FAILED` |
| `dryRunReport` | `Json?` | The full categorized dry-run report (matched/unmatched/mismatch/duplicate/unknown-code/malformed/incomplete/unexpected), kept so an admin can review it before approving, even after navigating away |
| `adminId` | `String` | Who ran the import |
| `startedAt` / `completedAt` | `DateTime?` | Timing |
| `createdAt` / `updatedAt` | `DateTime` | Audit timestamps |

- **Relations**: `examYear` (many-to-one, `onDelete: Cascade`, matching `ImportBatch`'s own behavior); `admin` (many-to-one, `onDelete: Restrict`, matching `ImportBatch`'s own behavior — an admin account can't be deleted while it has import history); `errors` (one-to-many); `grades` (one-to-many, the batch's own contribution to `CandidateSubjectGrade`).
- **Unique constraint**: `checksum @unique` — duplicate-upload protection, identical rationale to `ImportBatch.checksum`.
- **Index**: `@@index([examYearId, status])` — supports the admin history/monitoring views ("show me all batches for this year," "show me anything still `IMPORTING`").

### `GradeImportError`

Row-level rejection detail for a batch — the grade-data equivalent of `ImportError`.

| Field | Type | Purpose |
|---|---|---|
| `id` | `String @id` | Primary key |
| `rowNumber` | `Int` | Which row in the source this refers to |
| `field` | `String?` | Which field was the problem, if applicable |
| `message` | `String` | Human-readable reason |
| `rawData` | `Json?` | The original row, for admin inspection |
| `batchId` | `String` | Which batch this error belongs to |

- **Relations**: `batch` (many-to-one, `onDelete: Cascade` — errors are meaningless without their batch, matching `ImportError → ImportBatch`).
- **Unique constraint**: none (multiple errors per batch are expected).
- **Index**: `@@index([batchId])` — supports "show all errors for this batch."

---

## 7. How a subject grade flows through the system

```
Upload
  → admin picks a file (JSON/CSV/Excel) in the Grade Import admin screen;
    bytes are stored via the existing chunked-upload tables (ImportUpload/
    ImportUploadChunk), widened to accept these file types; a GradeImportBatch
    row is created with status UPLOADED, checksum computed for dedupe.

→ Normalization
    the adapter matching sourceType (JSON/CSV/Excel) reads the file, resolves
    a GradeSourceMapping (saved from a prior upload of the same shape, or
    created fresh), and produces an in-memory list of
    { examYear, examType, candidateNumber, series, subjectCode, mark } rows —
    the one shape every later step operates on, regardless of where the file
    came from.

→ Validation
    each normalized row is checked against existing data: does the candidate
    exist for (examYearId, candidateNumber)? does its series match the row's
    series? does subjectCode resolve to an active SubjectScheme row for that
    year/type/series? is the mark numeric and in range? are there duplicate
    rows for the same candidate+subject in the source itself?

→ Dry Run
    validation runs with zero writes; results are categorized (matched /
    unmatched / seriesMismatch / duplicateInputRows / unknownSubjectCodes /
    malformedMarks / incompleteSubjectSet / unexpectedSubjectSet) and stored
    in GradeImportBatch.dryRunReport (status → VALIDATED, or FAILED if
    unknownSubjectCodes is non-empty — that specific category hard-blocks
    the next step). The admin reviews this report before approving anything.

→ Import Batch
    on explicit admin approval, status → IMPORTING; matched, valid rows are
    written in chunks (mirroring insertCandidates's 2000-row, one-transaction-
    per-chunk pattern), GradeImportBatch.progressRows advances after each
    committed chunk so an interrupted run resumes exactly where it left off;
    excluded rows are recorded as GradeImportError rows, not silently dropped.

→ CandidateSubjectGrade
    each accepted row becomes one CandidateSubjectGrade row, linked to the
    matched Candidate and the resolved SubjectScheme, tagged with
    sourceBatchId for traceability. status → IMPORTED once all chunks commit.

→ Public API
    /api/public/candidate-grades reads CandidateSubjectGrade for one
    candidate only (never a list), joined to SubjectScheme for
    name/coefficient/order — queried only against MoriBac's own database,
    with no awareness of where the data originally came from.

→ Result Page
    the existing result card's "عرض درجات المواد / Voir les notes par
    matière" button calls that API lazily, on click, and renders the
    returned subject/mark/coefficient rows in curriculum order — the base
    search/result flow is unchanged whether or not grades exist yet.
```

---

## 8. Why each table exists

- **`GradeSourceMapping`** exists so the system never hardcodes any one provider's field names. Without it, "independent of Najahi" would only be true until the next source arrived with different names — with it, a new source is one saved mapping, not a code change.
- **`SubjectScheme`** exists because subject grades are meaningless without knowing what a code stands for and how it's weighted — and because that meaning genuinely varies by year, exam type, and series, it has to be reference data scoped exactly that way, not a hardcoded list in UI code.
- **`CandidateSubjectGrade`** exists as the actual fact table — deliberately a normalized row-per-mark table (per your explicit requirement) rather than wide columns on `Candidate`, so a series with 11 subjects and one with 8 both fit without sparse nulls, and so grades can be added, queried, or rolled back independently of the candidate record itself.
- **`GradeImportBatch`** exists because a 500,000+ row import must be resumable, auditable, and reversible — without a durable batch record, "resume after a crash" and "roll back this one import without touching others" are both impossible to do safely.
- **`GradeImportError`** exists so rejected rows are a queryable, reviewable list for the admin, not a number in a log file — mirroring how the existing candidate importer already treats row-level failures as first-class data (`ImportError`), not just console output.

---

*No code was modified to produce this document.*
