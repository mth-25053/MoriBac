# MoriBac — Project Handoff

**READ THIS FILE FIRST, before doing anything, if you are a new Claude conversation picking up this project.** It is the current source of truth for what's done, what's in progress, and what must not be skipped. Do not re-derive this from memory or assumptions — verify against the live repo/database if anything here seems stale, and update this file as state changes.

Last updated: 2026-07-31 (UTC), end of the **result-page improvements + PDF export** phase. Live in production at https://mth-bac.vercel.app.

---

## Current objective

**Done.** Original objective was: finish the BAC subject-grades feature (per-subject marks, not just the overall average), get the **BAC 2026 subject-grade dataset** (516,956 rows / 64,532 candidates) safely imported without ever guessing academic data, and deploy it — all without guessing subject names/coefficients/order that weren't confirmed from an authoritative source. All of that is complete and live. What remains is a narrow, well-defined gap: 11 subject codes still have no confirmed French name (see below) — everything else is done.

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
9. **Production import of `bac2026_import_ready.json` — completed and verified** (details below). All 516,956 rows are now live in `CandidateSubjectGrade`.
10. **Deployment and live end-to-end verification — completed** (details below). The application is live at https://mth-bac.vercel.app with all 7 series verified against the real production API.
11. **Result-page improvements + PDF export — completed and deployed** (details below): subjects now display automatically (no click), a redesigned summary/ranking section shows real "X out of Y" ranks, and a new "Download PDF" button generates a real (non-screenshot) bilingual A4 PDF of the full result.

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

## Deployment and live verification — completed

**Deployment timestamp (UTC)**: commit `5e7d4f5` pushed to `main` at `2026-07-31T02:22Z` (approx.); Vercel deployment `dpl_8Etnw8kxmpMMDxGrJ4T1pYDhiqST` started building `2026-07-31T02:28:51Z`, reached `Ready` ~1 minute later.

**Deployment identifier / URL**: production deployment `dpl_8Etnw8kxmpMMDxGrJ4T1pYDhiqST`, aliased to **https://mth-bac.vercel.app** (also aliased to `mori-bac.vercel.app` and two project-scoped `*.vercel.app` URLs — `mth-bac.vercel.app` is the canonical one to use).

**Method**: this is a git-linked Vercel project (`.vercel/project.json` → project `mth-bac`, org `mth-25053s-projects`; confirmed authenticated via `vercel whoami` before starting). The existing production workflow is: commit → `git push origin main` → Vercel's GitHub integration auto-builds and deploys. That's what was used — no ad-hoc `vercel --prod` CLI deploy, no bypass of the normal pipeline. The build ran exactly `prisma generate && next build` (the project's own `build` script) — **no migration or seed step runs during deployment**, so this step could not and did not touch grade data, matching the instruction not to modify or re-import anything.

Before pushing, `.agents/`, `.claude/`, and `skills-lock.json` (Claude Code tooling/local-settings artifacts, not application code) were deliberately excluded from the commit — only the actual application changes (63 grade-feature files, this doc, migrations, seed script) were staged and committed.

**Final safety checks immediately before deploying (all re-run fresh, all passed):**

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npx eslint . --max-warnings=0` | Passed, zero warnings |
| `npm test` | 205/205 passed (21 files) |
| `npm run build` | Passed |

**Pre-deploy production database re-confirmation** (read-only, immediately before pushing): `CandidateSubjectGrade` = 516,956, `SubjectScheme` = 63, `GradeImportBatch` = 1 row with status `IMPORTED`. All matched exactly.

### Live verification results — all 7 series, against the real deployed production API

Verified by calling the actual live endpoints (`https://mth-bac.vercel.app/api/public/search` and `/api/public/candidate-grades`) — not a library function, not localhost — for the same 7 candidates checked pre-deployment:

| Series | Candidate | Page/API loads | General info correct | Subject count | Order correct | Coefficients correct | Marks correct | EXEMPT handling |
|---|---|---|---|---|---|---|---|---|
| SN | 15049 | HTTP 200 | ✓ (Diondo Makhan Gandega, avg 10, ADMIS) | 8/8 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| M | 42942 | HTTP 200 | ✓ (avg 5.34, REDOUBLE) | 8/8 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| LM | 16875 | HTTP 200 | ✓ (avg 6.59, REDOUBLE) | 8/8 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| LO | 64903 | HTTP 200 | ✓ (avg 0, ABSENT) | 8/8 | ✓ | ✓ | ✓ | ✓ EP row: `EXEMPT`, mark `null` |
| TM | 17739 | HTTP 200 | ✓ (avg 3.14, REDOUBLE) | 11/11 | ✓ | ✓ | ✓ | n/a (all GRADED) |
| TS | 58544 | HTTP 200 | ✓ (avg 7.62, REDOUBLE) | 11/11 | ✓ | ✓ | ✓ | ✓ EP row: `EXEMPT`, mark `null` |
| LA | 28756 | HTTP 200 | ✓ (avg 12.77, ADMIS) | 9/9 | ✓ | ✓ | ✓ | n/a (all GRADED) |

Every value returned by the live production API — subject codes, order, coefficients, marks, `nameAr`/`nameFr` (including `null` for the 11 unresolved codes, correctly still `null` live) — matched exactly what was verified locally before deployment. Zero discrepancies.

**Additional live checks:**

| Check | Result |
|---|---|
| Arabic homepage (`/`, default) | HTTP 200, `<html lang="ar" dir="rtl">` |
| French homepage (`moribac_language=fr` cookie) | HTTP 200, `<html lang="fr" dir="ltr">` |
| Protected admin route (`/admin/grade-import`, unauthenticated) | HTTP 307 (redirects to login — correct, not a crash) |
| Public API with invalid/missing params | HTTP 400 with a clean `{"error":"INVALID_NUMBER"}` body — not a 500 |

**Honest limitation on this verification**: I do not have a real browser-automation tool available in this environment (no Playwright/screenshot capability). Everything above was verified by calling the live production HTTP endpoints directly and inspecting the exact JSON/HTML returned — this rigorously proves the data (subject count, order, coefficients, marks, EXEMPT logic, locale attributes, error handling) is correct on the live site. It does **not** prove browser-console-error-free rendering or actual mobile CSS/viewport behavior, since neither can be observed without a real browser. No fix was needed for anything checkable — if you (or a future session with browser tooling) spot-check one of the 7 candidates above in an actual mobile browser and something looks wrong, it would be a frontend/CSS issue, not a data issue — the data itself is confirmed correct end-to-end.

**Fixes made during deployment**: none were needed — no unexpected error occurred at any step.

---

## Result-page improvements + PDF export — completed and deployed

### Files changed

| File | Change |
|---|---|
| `components/result-card.tsx` | Redesigned: reordered summary details (series/institution/center prioritized), replaced the 5-tile rank display with a 3-item national/institution/center "X out of Y" ranking section, added the PDF button next to the existing Share button |
| `components/subject-grades-section.tsx` | Removed the idle state and its button; fetches automatically via `useEffect` on mount |
| `components/download-result-pdf-button.tsx` | **New.** Client button: fetches the PDF route, downloads the blob with a safe filename, loading/error states |
| `lib/results.ts` | `getCandidateRanks()` extended with `nationalTotal`/`schoolTotal`/`examCenterTotal` — real counts of the same non-ANNULE pool the rank itself is computed against |
| `lib/i18n.ts` | Added `outOf`, `fullNameLabel`, `downloadResultPdf` (exact text specified), `pdfGenerating`/`pdfDownloaded`/`pdfFailed`, `subjectColumnLabel`/`coefficientColumnLabel`/`markColumnLabel`, `pdfGeneratedOn`, `pdfDocumentTitle`, `pdfDisclaimer` — Arabic + French |
| `lib/pdf/fonts.ts` | **New.** Registers the two PDF fonts server-side from `public/fonts/pdf/` |
| `lib/pdf/result-document.tsx` | **New.** The `@react-pdf/renderer` document component — A4, bilingual, RTL/LTR |
| `app/api/public/candidate-result-pdf/route.tsx` | **New.** `GET` route: validates input, loads only the fields the PDF needs (no internal IDs), renders, returns as `application/pdf` with `Content-Disposition: attachment` |
| `public/fonts/pdf/{Tajawal,Lato}-{Regular,Bold}.ttf` | **New.** Static (non-variable) font files embedded in the PDF — see "PDF implementation details" for why these specific fonts |
| `tests/badges.test.ts`, `tests/results.test.ts`, `tests/subject-grades-section.test.tsx` | Updated for the new `CandidateRanks` fields and the click-free auto-fetch behavior |

### UI changes completed

- **Subjects display automatically.** `SubjectGradesSection` fetches on mount; the button and idle state are gone. Verified via `npm test` (loading/loaded/EXEMPT/empty/error/retry states, zero-click) and via the live production API for a candidate in every one of the 7 series plus two candidates with a real `EXEMPT` subject (LO, TS).
- **Ranking section**: exactly national/institution/center, each rendered as "label: rank {outOf} total" (e.g. "الترتيب الوطني: 17558 من أصل 64333" / "Rang national : 17558 sur 64333"), and **only when both the rank and its total are real, non-null values** — `RankTile` returns `null` (renders nothing) otherwise, never a zero/placeholder/fake number.
- **Summary**: name, number, series, institution, exam center, average, and status were already all present on the card; series/institution/center were reordered ahead of wilaya in the detail grid to match the requested priority. Average and status were already the most visually prominent elements (large accent-colored average, colored decision badge) and were left as-is.
- Arabic/French, RTL/LTR, responsive grid classes, and the existing visual system (`surface`, `badge`, CSS custom properties) are all unchanged — only content/structure inside the existing card shape changed.

### Ranking-data behavior

`getCandidateRanks()` now computes, for national/school/examCenter only (series/wilaya ranks are still computed for the badge system but not surfaced in this new section): the candidate's 1-based rank (`count of same-scope non-ANNULE candidates with a strictly higher average, + 1`) **and** a real total (`count of same-scope non-ANNULE candidates`), as two independent queries against the same live data — never one derived from the other, never estimated. A scope with no recorded value (e.g. `school: null`) yields `null` for both its rank and its total, and the UI/PDF both hide that item entirely rather than showing `0` or `—`.

### PDF implementation details

- **Library**: `@react-pdf/renderer` (`renderToBuffer`, server-side, Node runtime) — produces a real vector/text PDF via its own layout engine, not a browser screenshot or rasterized image.
- **Fonts — two real bugs found and fixed by rendering and visually inspecting test PDFs at every step, not by assumption:**
  1. A **variable-weight** TTF (Google Fonts' `[wght]` axis format) silently produced **wrong Arabic glyphs** (dropped/substituted letters, not just wrong weight) under react-pdf's fontkit-based shaping. Fixed by using only genuinely static (non-variable) font files.
  2. **Amiri** (a calligraphic Naskh typeface), tried next, rendered every Arabic string correctly *except* the word "ناجح" ("ADMIS"/passed — the single most important decision label in this app), which came out as a collapsed, illegible glyph in both weights — a reproducible font-specific ligature bug, confirmed by isolating the word alone in a minimal test PDF. Replaced with **Tajawal** (plain sans-serif, no calligraphic ligature table), verified correct for every decision/subject string actually used in this app, including "ناجح", in both weights.
  - Final fonts: **Tajawal** (Arabic, Regular+Bold) and **Lato** (French/Latin, Regular+Bold), both static TTFs from Google Fonts (OFL), embedded from `public/fonts/pdf/`.
  - A third, subtler bug: a subject with no confirmed French name falls back to its Arabic name (`subjectDisplayName()`) *even inside a French-locale PDF*. Since the French document's default font (Lato) has no Arabic glyphs, that fallback text rendered as garbage until a per-cell script check (`textFontFamily()` in `result-document.tsx`) was added to switch just that one table cell to the Arabic font regardless of document locale.
  - A fourth bug, specific to `@react-pdf/textkit`'s bidi engine: a single `<Text>` with two interpolated Western-digit numbers around Arabic words (e.g. `"{rank} {outOf} {total}"`) rendered with the numbers visibly out of order (`"9 من أصل 24"` → `"من أصل 24 9"`). Fixed by rendering rank/connector/total as three separate `<Text>` nodes inside a `row-reverse` flex `View` — the same mechanism already used (and already proven correct) for the subject table's column order — instead of relying on in-paragraph bidi reordering for mixed number/Arabic content.
  - A fifth issue (not a bug, expected behavior once diagnosed): the fixed-position footer was overlapping the last table row/spilling awkwardly. Fixed with a reserved `paddingBottom` on the page so content pagination always leaves room for the footer; an 11-subject series (TM, TS) now cleanly flows onto a clean page 2 when needed rather than a single cramped page.
- **PDF content**: brand/title header, BAC year, candidate name/number/series/institution/exam center, average, decision (with its emoji prefix stripped — Tajawal/Lato have no emoji glyphs, confirmed as a real rendering bug the same way as the others above), national/institution/center ranks (only when available, in the same "X out of Y" form as the web page), the complete subject table (name/coefficient/mark-or-EXEMPT, same order as the website — both read from the same `getCandidateSubjectGrades()`), generation date/time, and the required disclaimer.
- **Privacy**: the PDF data type (`ResultPdfData`) is deliberately narrow — no candidate `id`, `examYearId`, `importBatchId`, `birthDate`/`birthPlace`, or any other internal/private field is ever passed to the PDF renderer.
- **Filename**: `mthbac-{year}-{candidateNumber}.pdf` (e.g. `mthbac-2026-58544.pdf`), set via `Content-Disposition`.
- **Verified**: all 14 combinations (7 series × 2 locales) generated successfully against live production data and rasterized for direct visual inspection (not just "no error thrown") — including both EXEMPT-subject candidates (LO, TS) and the French-locale fallback-to-Arabic-name case (4 subjects on TS/TM). Every one checked correct after the fixes above.

### Tests and build results

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npx eslint . --max-warnings=0` | Passed, zero warnings |
| `npm test` | 203/203 passed (21 files; 2 obsolete click-button tests removed, replaced with auto-fetch equivalents) |
| `npm run build` | Passed (after releasing the Windows Prisma DLL lock held by the local dev server used for live-route testing — same known issue documented in `AUDIT_REPORT.md`) |

### Deployment

Committed as `dac05d3` and pushed to `main` (git-linked Vercel auto-deploy, same workflow as the prior phase). Deployment `dpl_6BrAk1dbSpbUN5mZFEKuFWmUxxU4` (target: production), created `2026-07-31T03:47:33Z`, build duration 59s, status `Ready`, aliased to **https://mth-bac.vercel.app** (also `mori-bac.vercel.app`).

**Live verification performed against this exact deployment** (not staging, not local): `/api/public/search` confirmed the new `ranks` object carries `nationalTotal`/`schoolTotal`/`examCenterTotal` (e.g. candidate 15049: national 5272/64333, institution 2/23, center 11/355 — matching the local pre-deploy values exactly). Both the SN (plain, Arabic) and TS (EXEMPT + French-fallback-to-Arabic subject names) PDFs were re-downloaded from the live endpoint and re-rasterized/visually inspected — pixel-identical to the pre-deploy verified output: correct "ناجح" decision label, correct rank ordering, correct EXEMPT/"Dispensé" handling, correct mixed-font fallback rendering.

### Honest limitation on this phase's verification

Every PDF was verified by actually rendering it and visually inspecting a rasterized image (not just checking HTTP 200) — this is real, not assumed, verification of the PDF output specifically. However, as with the previous deployment phase, **I have no real browser-automation tool** in this environment. The web-page-level requirements (subjects appearing without a click, the new ranking section, mobile/desktop layout) were verified through the underlying data/API/component logic and the test suite, not by opening the live site in an actual mobile or desktop browser. If you have browser tooling available, a real spot-check of the live result page (ideally on an actual phone) is the one remaining thing this session could not directly confirm.

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

## Remaining known limitations

1. **11 of the 21 BAC subject codes still have `nameFr: null`** (not guessed, per the operator's explicit instruction): `AF, AT, CH, CM, DM, DS, EL, ME, PH, PI, TA`. Their `nameAr` is confirmed (read directly off the official screenshots), and every coefficient/order/mapping for them is confirmed — only the French display label is missing. Both the web UI and the PDF fall back to the Arabic name (`subjectDisplayName()` in `lib/grades/subject-grades-client.ts`) when `nameFr` is null — verified rendering *correctly* in both places (the PDF specifically needed a per-cell font override, see above, since the fallback text is Arabic script even inside a French document). Not a blocker; resolve when an authoritative French source is available, then re-run `prisma/seed-subject-schemes-2026.ts` (idempotent) and redeploy.
2. **No real mobile/desktop browser was used to verify the result-page UI changes** (auto-shown subjects, new ranking section layout, PDF button placement) — this environment has no browser-automation tool. The underlying logic is verified (tests, live API/PDF data), but an actual visual/device check has not been done. The PDF output, by contrast, *was* verified visually (rendered and rasterized for direct inspection) — that's a stronger form of proof than the web-UI claims above.

## Current final project status

**Live and verified.** The BAC subject-grades feature (full 2026 dataset), the redesigned result summary/ranking section with real "X out of Y" values, automatic (no-click) subject display, and the bilingual PDF export are all deployed to production at **https://mth-bac.vercel.app** (deployment `dpl_6BrAk1dbSpbUN5mZFEKuFWmUxxU4`). No known data, backend, or PDF-rendering defects remain — every one found during this phase (variable-font glyph corruption, an Amiri ligature bug, emoji-in-PDF, mixed-script fallback font, bidi number reordering, footer/pagination overlap) was fixed and re-verified by rendering and visually inspecting the actual output, not assumed fixed.

## Next recommended step (optional, not blocking)

1. **A real-browser spot-check** of the result page (ideally on an actual mobile device), covering what this session could not: rendered CSS layout, browser console errors, and the PDF button's real download behavior in a live browser (the PDF *content* itself is already verified correct).
2. **Resolve the 11 remaining French subject names** (above) if/when an authoritative French-language source becomes available, then re-run the seed script and redeploy.

---

## Standing rules for whoever continues this work

- Never guess or invent academic data (subject names, coefficients, display order, any official BAC rule). If something can't be confirmed from an authoritative source, stop and ask.
- Never apply migrations, seed, import grades, or deploy without explicit operator approval, one step at a time.
- Never put database credentials, connection strings, or candidate PII into a committed file. Backups and raw extracted datasets belong outside this git repository.
- This file should be updated (not left stale) as soon as the next phase completes.
