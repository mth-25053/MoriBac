# MoriBac — Project Handoff

**READ THIS FILE FIRST, before doing anything, if you are a new Claude conversation picking up this project.** It is the current source of truth for what's done, what's in progress, and what must not be skipped. Do not re-derive this from memory or assumptions — verify against the live repo/database if anything here seems stale, and update this file as state changes.

Last updated: 2026-07-31 (UTC), end of the BAC 2026 grade **production import** phase. Import is done and verified. Deployment has not happened yet.

---

## Current objective

The BAC subject-grades feature is now fully live in the database (not yet on the public website — deployment is the next, separate, approval-gated step). Original objective was: finish the BAC subject-grades feature (per-subject marks, not just the overall average) and get the **BAC 2026 subject-grade dataset** (extracted from Najahi, 516,956 rows / 64,532 candidates) safely imported — without ever guessing academic data (subject names, coefficients, curriculum order) that wasn't confirmed from an authoritative source. **That import is now complete.** What remains is deploying the application and verifying the change on the live public site.

---

## Completed so far

1. **Subject-grade feature (schema, importer, dry-run, resume, rollback, public API, UI, discovery tool)** — built in an earlier session, fully implemented and tested (205/205 tests passing). Includes the `GRADED`/`EXEMPT` status model so a null mark (e.g. an EP/Physical-Education exemption) is stored as a real academic status, never guessed or treated as malformed.
2. **Two leftover TypeScript errors from that session were found and fixed** (fallout of `mark` becoming nullable): the grade-report CSV/JSON download route's local type, and one test fixture missing the `status` field. `npm run build` now passes clean.
3. **Admin Dry Run UI improvement**: separate Graded/Exempt row counts now shown, with Arabic/French labels, alongside the existing Importable/Rejected totals.
4. **BAC 2026 raw dataset located and verified**: extracted by a prior session into `C:\Projets\najahi-bac2026-extraction\output\` (outside this git repo, not tracked, not ignored — just external). `bac2026_import_ready.json` checksum re-verified twice against `checksums.sha256`, unchanged.
5. **Subject metadata recovery investigation** (read-only, no guessing): confirmed the extraction's own `bac2026_subject_scheme_map.json` had all names/coefficients as `null` by design; found a BEPC-specific (not BAC) name/coefficient dictionary inside Najahi's client JS bundle, used only as corroborating evidence, never as a direct BAC source; recovered the per-series subject *order* directly and exhaustively from all 64,532 raw candidate records (100% consistent, zero exceptions).
6. **Official BAC 2026 screenshots provided by the operator** (one per series: SN, M, LM, LA, LO, TM, TS) — treated as the authoritative source. Every subject, coefficient, and display order was extracted and cross-validated against the raw-data order recovered in step 5 (100% positional match everywhere independently checkable). All 21 subject codes across all 7 series were matched with certainty. **11 codes have no confirmed French name and are stored as `null`, not guessed**: `AF, AT, CH, CM, DM, DS, EL, ME, PH, PI, TA`.
7. **Database backup, migrations, and SubjectScheme seed — completed and verified** (details below).
8. **Read-only BAC 2026 grade dry-run validation — completed and verified, zero database writes, zero rejections** (details below). The dataset is confirmed ready for production import.
9. **Production import of `bac2026_import_ready.json` — completed and verified** (details below). All 516,956 rows are now live in `CandidateSubjectGrade`. The application has **not** been deployed yet.

---

## Database preparation phase — what was done

### 1. Backup

- **Method**: `supabase db dump` was attempted first but requires Docker, which is not installed/running in this environment — that path was abandoned rather than forced. Used instead: a Prisma-based **logical backup** — every row of every table that exists in the live schema (pre-migration) was read via Prisma Client and written to one JSON file per table, plus a manifest with row counts and start/end timestamps. Combined with the already-version-controlled `prisma/schema.prisma` and every migration's `migration.sql` (the DDL/schema definition), this is a complete, restorable backup of both structure and data given the tools available in this environment.
- **Timestamp (UTC)**: started `2026-07-31T01:36:18Z`, completed `2026-07-31T01:36:53Z`.
- **Location**: `C:\Projets\MthBac-db-backups\20260731T013618Z\` — **outside this git repository** (sibling directory, never committed), for the same reason `BAC*.xlsx` is kept out of git: candidate PII (names, birth dates, birth places).
- **Verification performed**: re-parsed the largest file (`candidate.json`, 164,897 rows) back from disk and confirmed the row count matches the live database exactly; every table's manifest count matches. No secrets (connection strings, passwords) appear anywhere in the backup files or in this document — only data rows and a row-count manifest.
- **No database passwords or connection strings are recorded anywhere in this file.** `DATABASE_URL`/`DIRECT_URL` remain only in the untracked, gitignored `.env`.

### 2. Migrations applied

Ran, in order, exactly as approved:

```
npx prisma migrate deploy
npx prisma migrate status
npx tsx prisma/seed-subject-schemes-2026.ts
```

Migrations applied (all 4, confirmed via `prisma migrate status` → "Database schema is up to date!"):

1. `20260730161313_add_subject_grades`
2. `20260730174045_add_grade_import_batch_upload_id`
3. `20260730175850_grade_import_safety_refinements`
4. `20260730193025_add_grade_status_exempt`

### 3. SubjectScheme seed — verification results (all read-only checks passed)

| Check | Result |
|---|---|
| `SubjectScheme` table exists | Yes |
| Total rows | **63** (exact) |
| Duplicate `series + subjectCode` pairs | **None** |
| `displayOrder` consecutive & unique per series | **True for all 7 series** |
| Coefficient totals per series | SN=32, M=32, LM=32, LA=32, LO=32, TM=32, TS=32 — **all match** |
| Codes with `nameFr = null` (unresolved, not guessed) | `AF, AT, CH, CM, DM, DS, EL, ME, PH, PI, TA` (11) |
| Codes with `nameFr` set (BEPC-confirmed) | `AN, AR, EP, ES, FR, HG, IR, MT, PC, SN` (10) |
| Candidate total, all years | **164,897** — unchanged from the pre-migration baseline |
| ExamYear rows | 2024 (published), 2025 (published), 2026 (published, default) — unchanged |

Note: the M-series screenshot's own displayed total was 31, not 32, for one specific EXEMPT-EP candidate — that's expected runtime behavior (an exempt subject's coefficient correctly drops out of *that candidate's* computed total), not a scheme defect. The **scheme's** stored coefficient for M is unconditionally 32, which is correct and confirmed above.

### Tests/build status (last run before this phase, still the current baseline)

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npx eslint . --max-warnings=0` | Passed, zero warnings |
| `npm test` | 205/205 passed (21 files) |
| `npm run build` | Passed — full route manifest generated, no errors |

---

## BAC 2026 grade production import — completed and verified

**Import timestamp (UTC)**: started `2026-07-31T02:14:40.083Z`, completed `2026-07-31T02:19:35.972Z`. Duration: **295,889 ms (~4 minutes 56 seconds)** for 516,956 rows.

**Method**: a script (`import-bac2026.ts`, run via `npx tsx`, deleted after use — not committed) that calls the exact same library functions the real `/api/admin/grade-import/dry-run` and `/api/admin/grade-import/commit` routes call, in the same order: `saveGradeDryRunReport()` (creates the `GradeImportBatch` row with the same checksum/`schemeChecksum`/`candidateDatasetChecksum` fingerprints the real dry-run route computes) → `resolveSubjectSchemeIds()` → `insertGradeRows()` (the project's existing chunked-2,000-row, resumable, transactional insert, using the same `IMPORTING`-status partial-unique-index lock as the real commit route). The only thing this script didn't go through is the HTTP/session/CSRF layer, since there was no running admin browser session in this context — the underlying transactional/resumable import logic is identical to production. No unexpected error occurred; nothing needed to stop or resume.

**Import statistics — every statistic requested:**

| Statistic | Value |
|---|---|
| Total rows imported | 516,956 |
| Total candidates affected | 64,532 |
| Total numeric (GRADED) grades imported | 498,739 |
| Total EXEMPT rows imported | 18,217 |
| Import duration | 295,889 ms (~4m 56s) |
| Final `CandidateSubjectGrade` row count | **516,956** |
| Skipped rows | **0** |
| Warnings (unmatched / seriesMismatch / duplicateInputRows / malformedMarks / incompleteSubjectSets / unexpectedSubjectSets) | all **0** |

Batch record: `GradeImportBatch` id `cms8b8e890002uox0g9fr3i0e`, `sourceFileName: "bac2026_import_ready.json"`, final `status: "IMPORTED"`, `totalRows: 516956`, `importedRows: 516956`.

### Post-import verification (random candidate per series, using the real public read path)

Verified via `getCandidateSubjectGrades()` (`lib/grades/public-grades.ts` — the exact function the public `/api/public/candidate-grades` route uses), one randomly selected candidate per series:

| Series | Candidate | Subjects | Order matches `SubjectScheme` | Coefficients match | Grades correct | EXEMPT handling |
|---|---|---|---|---|---|---|
| SN | 15049 | 8/8 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| M | 42942 | 8/8 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| LM | 16875 | 8/8 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| LO | 64903 | 8/8 | ✓ | ✓ | ✓ | ✓ — EP row correctly `EXEMPT`, mark `null`, displayed as "EXEMPT (no mark)" |
| TM | 17739 | 11/11 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| TS | 58544 | 11/11 | ✓ | ✓ | ✓ | ✓ — EP row correctly `EXEMPT`, mark `null` |
| LA | 28756 | 9/9 | ✓ | ✓ | ✓ | n/a (all GRADED) |

For every one of the 7 candidates: candidate identity/average/decision loaded correctly, the subject list exactly matched `SubjectScheme`'s row count for that series, subject order exactly matched `SubjectScheme.displayOrder`, every coefficient matched `SubjectScheme.coefficient`, every `GRADED` row had a non-null numeric mark, every `EXEMPT` row had a null mark (zero exceptions in either direction, checked explicitly).

### Current database status (final, read-only confirmation)

| Check | Value |
|---|---|
| `Candidate` total, all years | **164,897** — unchanged from every prior baseline |
| `CandidateSubjectGrade` total | **516,956** |
| — of which `GRADED` | 498,739 |
| — of which `EXEMPT` | 18,217 |
| `GradeImportBatch` rows | 1 (`IMPORTED`) |
| `SubjectScheme` rows | 63 (unchanged from the seed phase) |

---

## What was explicitly NOT done yet (by instruction)

- **The application has not been deployed.** The database now has the full BAC 2026 subject-grade dataset live, but the public website has not been redeployed/re-verified against it yet.

---

## BAC 2026 dataset — current location and checksum

- File: `C:\Projets\najahi-bac2026-extraction\output\bac2026_import_ready.json`
- SHA-256: `b2ae5df031fdebe7edff270a2240e8fa77e6c4551fcd7e1a698174e35ae8b6c2`
- Size: 74,310,745 bytes
- Re-verified against `checksums.sha256` in the same directory immediately before this database phase — unchanged, intact.
- Contains 516,956 subject-grade rows for 64,532 candidates (498,739 `GRADED`, 18,217 `EXEMPT` — all EXEMPT rows are `subjectCode: "EP"`).
- Field names (`candidateNumber`, `examYear`, `exam`, `series`, `subjectCode`, `mark`) already match `lib/grades/default-mapping.ts`'s `DEFAULT_JSON_FIELD_MAPPING` — no mapping work needed.

---

## BAC 2026 grade dry-run validation — completed and verified

**Dry-run date/time (UTC)**: started `2026-07-31T01:59:36.916Z`, completed `2026-07-31T02:00:15.152Z`.

**Method**: a standalone, read-only script (`dry-run-bac2026.ts`, run via `npx tsx`, deleted after use — not committed) that called the project's own `normalizeJsonRows` → `validateGradeRows` pipeline (`lib/grades/json-adapter.ts`, `lib/grades/validate.ts`) against `bac2026_import_ready.json`, using `PrismaCandidateLookup`/`PrismaSubjectSchemeLookup` (`lib/grades/lookups.ts`) for read-only candidate/scheme lookups. It deliberately never called `saveGradeDryRunReport` (writes a `GradeImportBatch` row) or `insertGradeRows` (writes `CandidateSubjectGrade` rows) — **zero database writes occurred**. This was chosen over the real `/api/admin/grade-import/dry-run` route specifically because that route *does* persist a `GradeImportBatch` row even in "dry run" mode, which would have violated the "do not modify the database" requirement for this phase.

**Validation summary — every statistic requested:**

| Statistic | Value |
|---|---|
| Total rows processed | 516,956 |
| Total candidates found (in file, distinct) | 64,532 |
| Total candidates matched in database | 64,532 |
| Total numeric (GRADED) grades | 498,739 |
| Total EXEMPT rows | 18,217 |
| Unknown subject codes | **0** |
| Unknown/unmatched candidates | **0** |
| Series mismatches | **0** |
| Duplicate grade rows (same candidate+subject in file) | **0** |
| Malformed rows (structural) | **0** |
| Malformed marks (out-of-range numeric) | **0** |
| Missing required fields | **0** (0 malformed rows of any reason) |
| Incomplete subject sets (candidate missing an expected subject) | **0** |
| Unexpected subject sets (subject not in that candidate's series scheme) | **0** |
| Estimated rows that would be inserted | **516,956** (100%) |
| Estimated rows that would be skipped | **0** |

**Validation warnings**: none. Every category came back empty.

**Result: no validation error exists.** The full dataset — all 516,956 rows across all 64,532 candidates in all 7 series — matched cleanly against the now-seeded `SubjectScheme` and existing `Candidate` data, with zero rejections in every category the importer tracks.

**"The dataset is ready for production import."**

## Remaining known limitation

**11 of the 21 BAC subject codes still have `nameFr: null`** (not guessed, per the operator's explicit instruction): `AF, AT, CH, CM, DM, DS, EL, ME, PH, PI, TA`. Their `nameAr` is confirmed (read directly off the official screenshots), and every coefficient/order/mapping for them is confirmed — only the French display label is missing. The public subject-grades UI (`components/subject-grades-section.tsx`) falls back to the Arabic name (or the raw code, per `subjectDisplayName()` in `lib/grades/subject-grades-client.ts`) when `nameFr` is null, so this does not block display — a French-locale user will just see the Arabic name or code for these 11 subjects until the French names are confirmed and the seed script (`prisma/seed-subject-schemes-2026.ts`) is updated and re-run (it's an idempotent upsert, safe to re-run).

## Next recommended step

**Deploy the application, then verify the change on the live public website.**

Suggested verification once deployed: search for one or two of the same candidates verified above (e.g. `15049` for SN, `64903` for LO — the one with a real EXEMPT EP row) on the live public site, open "عرض درجات المواد / Voir les notes par matière", and confirm the subject list, order, coefficients, marks, and the EXEMPT label render correctly in the actual browser UI (not just via the library function, which was what this phase verified). This is the one thing not yet checked end-to-end through the real HTTP/browser path.

---

## Standing rules for whoever continues this work

- Never guess or invent academic data (subject names, coefficients, display order, any official BAC rule). If something can't be confirmed from an authoritative source, stop and ask.
- Never apply migrations, seed, import grades, or deploy without explicit operator approval, one step at a time.
- Never put database credentials, connection strings, or candidate PII into a committed file. Backups and raw extracted datasets belong outside this git repository.
- This file should be updated (not left stale) as soon as the next phase completes.
