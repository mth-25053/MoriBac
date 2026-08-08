# MoriBac — Project Handoff

**READ THIS FILE FIRST, before doing anything, if you are a new Claude conversation picking up this project.** It is the current source of truth for what's done, what's in progress, and what must not be skipped. Do not re-derive this from memory or assumptions — verify against the live repo/database if anything here seems stale, and update this file as state changes.

Last updated: 2026-07-31 (UTC), end of the **result-page reorder (mobile UI refinement)** phase. Live in production at https://mth-bac.vercel.app.

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
12. **Performance optimization — completed and deployed** (details below): homepage Top Candidates now server-rendered (no blank-then-fetch wait), candidate-number search caches recent lookups and auto-searches, and a real production-database bug was found and fixed where the public filter-options query (series/wilaya/school/center dropdowns) was silently pulling the entire candidate table over the wire instead of letting Postgres deduplicate it — cut from 3-9s to ~0.3-0.7s per call.
13. **Result-search UX + recent searches — completed and deployed** (details below): a localStorage-backed "recent searches" chip list (last 5, number+year only, no PII), a fixed auto-search debounce bug (year changes for the same number no longer got silently skipped), and an in-flight-request guard so an identical number+year search is never fired twice concurrently.
14. **Result-page reorder (mobile UI refinement) — completed and deployed** (details below): reordered the result card's content per an explicit operator spec (name/number → result+average → conditional pass/fail message → 2×2 candidate-details grid → stream+school rankings only → subject grades → actions), added a `seriesTotal` field to the ranking system so the stream rank can show as "X out of Y", and added a compact pass/fail message pair to the dictionary. No visual redesign, no color/spacing changes beyond what the reorder required, no other feature touched.

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

## Performance optimization phase — completed and deployed

**Objective**: homepage felt slow before Top Candidates appeared; candidate-number search, name search, and filter/roster navigation all felt sluggish. Scope was strictly performance — no data, ranking, PDF, or UI-shape changes.

### Root cause found (the dominant bottleneck)

`getFilterOptions()` (`lib/results.ts`) built the series/wilaya/school/exam-center dropdown lists using Prisma's `findMany({ distinct: [...] })`. Measured directly against the live production database with query logging enabled, this **does not push the deduplication down to SQL**: Prisma issues a plain `SELECT id, <column> FROM "Candidate" WHERE "examYearId" = ... OFFSET 0` with no `DISTINCT` and no `LIMIT`, pulls every matching row (tens of thousands per exam year) over the wire, and deduplicates client-side. A ~15-row answer was costing a full-table read:

| Query | Before (Prisma `distinct`) | After (raw `SELECT DISTINCT`) |
|---|---|---|
| `getFilterOptions` (unfiltered, 2 parallel reads) | 3.1s – 9.2s | 0.6s – 0.7s |
| Same query, EXPLAIN ANALYZE at the SQL level | n/a (full scan, ~64k rows returned to Node) | 97-100ms, 15 rows returned |

This function runs on **every** homepage load (via `getHomeInitialData`) and on every series/wilaya filter change in the rankings section (via `/api/public/meta`) — it was the single largest source of "navigation feels slow." Fixed by replacing all four `distinct` calls with parameterized `SELECT DISTINCT ... ORDER BY` queries via `database.$queryRaw(Prisma.sql...)`. Same inputs/outputs, `tests/results.test.ts` updated to assert the generated SQL/params instead of the old `where` shape. This was investigated and fixed in-repo, not by touching the database schema — no index/migration was needed, since a real `DISTINCT` query already used the existing indexes efficiently (confirmed via `EXPLAIN ANALYZE`).

### Other changes in this phase

| Area | Change |
|---|---|
| Homepage (`app/page.tsx`, `lib/results.ts: getHomeInitialData`) | Server-resolves the published year, filter options, and page 1 of unfiltered Top Candidates before the page HTML is sent. Verified live: the homepage response body already contains the rendered podium/rank rows, not an empty shell waiting on a client fetch. `HomeExperience`/`RankingsSection` accept this as `initialMeta`/`initialRankings` and skip their first redundant client-side re-fetch of the exact same data. |
| Candidate-number search (`components/home-experience.tsx`) | Recent lookups cached client-side (`Map`, capped at 20 entries, keyed by `number:year`) so repeat searches and back/forward navigation resolve with no network round-trip. Auto-searches 400ms after the visitor stops typing a valid number, in addition to the existing Enter/click submit. Previous in-flight request is aborted before a new one starts (already existing `AbortController` pattern, unchanged). |
| Name search | Already debounced (300ms), already cancels stale requests via `AbortController`, already selects only the fields the result list needs (`lib/results.ts: searchCandidatesByName`) — confirmed via query log this was not a bottleneck (single indexed-scoped `ILIKE`, ~100-140ms at the SQL level); left as-is. |
| Rankings/browse queries (`lib/results.ts`) | The independent read pairs in `getCandidateRanks`, `browseResults`, and `getFilterOptions` (rank+total, candidates+count, decisionCounts+aggregate, distinct lookups) now run via `Promise.all` instead of sequential `await`, since none of them depend on each other's result and the pooled Prisma client already bounds real concurrent connections. |
| Navigation (`components/rankings/{rankings-section,rankings-filters,filterable-list}.tsx`) | School/exam-center entries in the filter list now call `router.prefetch()` on hover/focus (in addition to `router.push()` on click), so the destination route's RSC payload is already warm by the time the visitor clicks. |
| PDF generation | Confirmed already isolated to its own server route (`app/api/public/candidate-result-pdf/route.tsx`, Node runtime) — `@react-pdf/renderer` was never part of any client bundle, so no lazy-loading change was needed there. |

### Verification performed

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npx eslint . --max-warnings=0` | Passed, zero warnings |
| `npm test` | 203/203 passed (21 files) |
| `npm run build` | Passed |
| Local dev run against the live production database | Homepage HTML confirmed to already contain rendered Top Candidates markup (podium + rank rows) on first response; `/api/public/meta?series=M` (the previously-expensive filtered path) returned in well under 1s |
| Live production spot-check post-deploy (`https://mth-bac.vercel.app`) | Homepage 200, Top Candidates present in the raw HTML; `/api/public/meta?series=M` warm ≈ 0.35s; `/api/public/search-name?query=idy` warm ≈ 0.3s; `/api/public/search?number=00002&year=2025` warm ≈ 0.3s (first/cold hits were higher, consistent with Vercel serverless cold start + `unstable_cache` needing to populate) |

**Honest limitation**: timings above were measured from this development machine over the general internet to the Supabase database (`eu-north-1`), not from inside Vercel's network — absolute milliseconds will differ in Vercel's own region-to-region latency. The relative improvement (full-table read → real `DISTINCT`, ~5-9x fewer bytes/round-trips for the same answer) is architecture-level and holds regardless of where it's measured from. No real mobile/desktop browser was used to eyeball perceived responsiveness (same tooling limitation noted in the prior phase); the auto-search debounce, prefetch-on-hover, and server-rendered Top Candidates were verified through code, tests, and direct HTTP/HTML inspection of both local-against-prod-DB and the live deployment.

### Deployment

Committed as `a862276` and pushed to `main` (git-linked Vercel auto-deploy). Deployment reached `Ready` and was aliased to **https://mth-bac.vercel.app**; live endpoints re-verified post-deploy (see table above).

## Result-search UX + recent searches phase — completed and deployed

**Objective**: make candidate-number search feel instant and add a "recent searches" convenience list, without touching data, rankings, PDF generation, or any public route contract. Scope also included re-confirming (not redoing) the prior performance phase's homepage/filter-options work.

### Files changed

| File | Change |
|---|---|
| `lib/recent-searches.ts` | **New.** Pure client-side localStorage helpers: `loadRecentSearches`, `saveRecentSearch`, `clearRecentSearches`. Stores only `{ candidateNumber, year }` — never a name, average, decision, or grade. |
| `components/recent-searches.tsx` | **New.** Presentational chip list using the existing `.chip`/`.chip-row` CSS (same visual language as the series filter chips) — renders nothing when the list is empty. |
| `components/home-experience.tsx` | Wires the recent-searches list into the number-search form; fixes the auto-search debounce's stale guard; adds an in-flight-request-key guard; extends the existing in-memory number-search cache to also carry the resolved year. |
| `lib/i18n.ts` | Added `recentSearches` / `clearRecentSearches` — Arabic ("آخر عمليات البحث" / "مسح السجل") and French ("Recherches récentes" / "Effacer"), exact text as specified. |

### Recent-search behavior

- Chips render **above** the number-search button, inside the same "number" search-mode form; hidden entirely (`return null`) when the list is empty.
- Stores at most 5 entries, newest first, deduplicated by **candidateNumber + year together** (not number alone) — a `2026/00042` and a `2025/00042` are two distinct entries, per the "scope by exam year" requirement.
- An entry is written only after a **successful** open (candidate actually found) — not for a not-found search, and never on a network/service error.
- Re-searching an already-listed number+year moves it back to first position instead of duplicating it.
- Clicking a chip sets the year selector to that chip's year (`selectRecentSearch`), then calls the existing `openCandidate` with that year as an explicit override — so it searches the *chip's* year even if a different year is currently selected in the dropdown, then loads instantly if that number+year is still in the in-memory session cache, or via a fresh request otherwise.
- Populated via `useEffect(() => setRecentSearches(loadRecentSearches()), [])` — i.e. **after mount only**. Server-rendered HTML and the client's first hydration pass both see an empty list (no `window`/`localStorage` on the server), so there is no hydration mismatch; the chips simply appear a moment after mount once localStorage has been read. This is the standard, warning-free way to surface client-only storage in a component that Next.js also renders on the server.

### Privacy decisions

- **Never stored**: candidate name, average, decision, series, wilaya, school, exam center, subject grades, or any other result field. `lib/recent-searches.ts`'s `RecentSearch` type is `{ candidateNumber: string; year: string }` and nothing else — there is no code path that could accidentally widen it, since the type itself is the only shape `saveRecentSearch` accepts.
- **Never sent to the server or database**: this is a client-only `localStorage` feature; no new API route, no new database table/column. A "recent search" surviving a page reload is purely a property of the visitor's own browser.
- Reading/writing localStorage is wrapped in `try/catch` (private browsing, storage quota, or disabled storage all degrade to "no recent searches" rather than throwing).

### Caching behavior (three distinct layers — none of them new except the fix noted)

1. **In-memory session cache** (`numberCache` in `home-experience.tsx`, pre-existing from the prior phase): keyed by `candidateNumber:year`, capped at 20 entries, cleared on tab close/reload — never persisted. Extended this phase to also store the *resolved* year returned by the API (so a cache-hit can still correctly re-file a recent-search entry with the right year). Still only ever returns a cached result when both the number and the year match exactly.
2. **`unstable_cache`-backed server caches** (`getPublishedYearCached`, `getFilterOptionsCached`, `browseResultsCached` in `lib/results.ts`) — unchanged from the prior phase.
3. **`localStorage` recent-searches list** (new, this phase) — number+year only, never result data, as above.
- **In-flight request guard** (new, this phase): a ref tracks the `candidateNumber:year` key currently being fetched; a second trigger for the exact same key (e.g. the 400ms auto-search timer firing right as the visitor also presses Enter) is now a silent no-op instead of a second network request, closing a real gap the prior phase's abort-on-new-request logic didn't cover (it cancelled-and-restarted rather than recognizing "this is the same request already in flight").

### Bug fixed: auto-search debounce ignored year changes

The auto-search effect's guard was `if (candidate && candidate.candidateNumber === clean) return;` — it compared only the candidate number, not the year. Changing the year dropdown while the number field still held an already-displayed candidate's number silently blocked the debounce from ever re-searching, since the guard matched on number alone. Replaced with a `lastOpenedKey` ref storing the exact `number:year` key of the last *resolved* search (found or not-found); the guard now checks that composite key, so switching years for the same number correctly re-triggers a search, while a genuinely unchanged number+year still doesn't refetch on every keystroke-triggered re-render.

### Item 4 (Top Candidates / homepage) — reviewed, not modified

Re-read `app/page.tsx`, `lib/results.ts: getHomeInitialData`, and `components/rankings/rankings-section.tsx` end-to-end. Confirmed, without changing anything:
- Top Candidates is server-rendered (`getHomeInitialData` resolves year + filter options + page 1 of rankings before the page HTML is sent).
- No duplicate client fetch on mount: `RankingsSection`'s `isFirstOptionsRun`/`isFirstResultsRun` refs skip the first effect run when `initialData`/`initialOptions` already cover that exact (unfiltered, default-year) case.
- `getFilterOptions` (`lib/results.ts`) uses real `SELECT DISTINCT` raw SQL, not Prisma's `distinct` option — the full-table-scan bug from the prior phase is gone and was not reintroduced.

### Item 5 (large lists) — reviewed, already sufficient, not modified

`components/rankings/roster-page.tsx` (used by `/schools/[school]` and `/centers/[center]`) already paginates via `PAGE_SIZE = 50` (`lib/constants.ts`) with an explicit "load more" (`loadMore`/`hasMore = page < pageCount`) rather than rendering an unbounded list. The homepage's own Top Candidates section intentionally shows only the first page with no "load more" (it's a showcase, not a full roster) — this is existing, correct behavior, left as-is. No virtualization was added; none of these lists render more than 50 rows at a time.

### Tests and build results

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npx eslint . --max-warnings=0` | Passed, zero warnings |
| `npm test` | 203/203 passed (21 files) — unchanged from the prior phase, no test needed new/changed assertions since this phase added a client-only UI feature with no existing test coverage of `home-experience.tsx`'s internals |
| `npm run build` | Passed (after releasing the Windows Prisma DLL lock held by a stale local dev server on port 3000 — same known issue documented in the README's "Windows Prisma EPERM repair" section; the dev server was restarted afterward) |
| Local dev run | Homepage 200, contains the number-search form markup; `search-name` API 200 — confirmed no SSR/hydration crash from the new `RecentSearches` component (renders `null` server-side since the list is empty until after mount) |

### Deployment

Committed as `30ea37d` and pushed to `main` (git-linked Vercel auto-deploy, same workflow as prior phases). Deployment `dpl_BKr1S2LauTTRtRX86rzV2FZmMfjJ`, created **2026-07-31T13:05:57Z**, reached `Ready` in 59s, aliased to **https://mth-bac.vercel.app**. Live re-verification immediately after: homepage 200 with the number-search form present, `/api/public/search?number=00002&year=2025` 200, `/api/public/search-name?query=idy` 200, `/api/public/meta?series=M` 200 (consistent with the prior phase's already-fixed timing).

### Remaining limitations

1. No real mobile/desktop browser was used to eyeball the new recent-searches chips visually (RTL wrapping, touch target size) — same environment limitation noted in prior phases (no browser-automation tool here). Verified through code review (reuses the existing, already-mobile-verified `.chip`/`.chip-row` CSS used elsewhere on this page), the live HTML response, and the hydration-safety argument above.
2. `home-experience.tsx` has no dedicated automated test file — this phase's changes were verified via typecheck/build/live HTTP checks, not new unit tests, since none existed for this component to extend before this phase either.
3. The 11 subject codes with `nameFr: null` and the "real-browser spot-check" item from the prior two phases remain open, unrelated to this phase's scope.

### Next recommended step (optional, not blocking)

1. A real-browser/mobile spot-check of the recent-searches chips (RTL layout, tap target size, wrapping with 5 chips on a narrow screen).
2. If this component grows further, consider adding a `home-experience.test.tsx` (none exists today) covering the auto-search/cache/recent-search interactions directly rather than only through typecheck+build+live checks.

## Result-page reorder (mobile UI refinement) phase — completed and deployed

**Objective**: reorganize the result card's content order per an explicit, itemized operator spec, without redesigning it — no color changes, no new features, no touching components not named in the spec (subject-grade calculations, PDF layout, share-card image, caching, recent searches, all left untouched).

### Files changed

| File | Change |
|---|---|
| `components/result-card.tsx` | Reordered the card's JSX to: (1) candidate name + number, (2) decision badge + average ("result card", primary focus), (3) a conditional pass/fail message, (4) the 4 candidate-detail tiles as a 2×2 grid on mobile (`grid-cols-2`, was single-column below `sm:`), (5) a rankings section now showing only stream (series) + school ranks, (6) the unchanged `SubjectGradesSection`, (7) Share/PDF actions, moved from above the details grid to below the subject grades. Removed the national/exam-center `RankTile`s and the now-unused `Globe2` icon import. |
| `lib/results.ts` | `CandidateRanks` and `getCandidateRanks()` gained a `seriesTotal` field — the same `total({ series })` pattern already used for `schoolTotal`/`examCenterTotal`, added as a 9th parallel query in the existing `Promise.all`. Needed because the spec requires the stream ranking to render as "X out of Y" like the school ranking already does, and no such total existed before this phase (only a bare `series` rank, used solely for badge logic). `national`/`examCenter`/`nationalTotal`/`examCenterTotal` are all still computed and returned unchanged — only the web result card stopped displaying them; the PDF (`app/api/public/candidate-result-pdf`) and badge logic (`lib/badges.ts`) still use the full set and were not touched. |
| `lib/i18n.ts` | Added `resultPassTitle` / `resultPassSubtitle` (Arabic: exact operator-specified text; French: equivalent translation) and `resultFailMessage` (same). The pre-existing `congratulations` key was left in place (unused by the new message, kept in case anything else references it later) rather than deleted, since deleting working, harmless code wasn't part of the requested scope. |
| `tests/results.test.ts`, `tests/badges.test.ts` | Updated the `CandidateRanks` fixtures/assertions to include `seriesTotal`, and added an explicit call-count/where-clause assertion for the new `total({ series })` query. |

### Behavior of the conditional message (item 3 of the spec)

- `decision` classifies to `ADMIS` → shows `resultPassTitle` (bold, celebrate-colored) + `resultPassSubtitle` (muted) — two lines, compact.
- `decision` classifies to `REDOUBLE` → shows `resultFailMessage` only (single muted line).
- `SESSIONNAIRE` (second session), `ABSENT`, `ANNULE`, or any unrecognized decision string → no message at all, exactly as specified ("Do NOT display any message" for second session; nothing in the spec calls for a message in the other cases either, so none was added — avoids inventing UI copy the operator didn't ask for).
- The existing confetti (`SuccessCelebration`, ADMIS-only) and share/PDF button behavior are unchanged.

### Candidate-details grid (item 4)

The 4 detail tiles (series/school/center/wilaya) were already in the exact row-major order the spec requires (stream, school / center, wilaya) — only the grid's mobile column count needed to change. Previously the `dl` had no explicit column count below the `sm:` breakpoint, so with no `grid-template-columns` set, each `dt`/`dd` pair rendered as its own full-width row (the "four separate vertical cards" the spec described). Added `grid-cols-2` as the base (mobile) class; `lg:grid-cols-4` (desktop) is unchanged, preserving the desktop layout exactly as required.

### Rankings section (item 5)

Now renders at most 2 tiles — stream (`dict.rankLabel`, "الترتيب في الشعبة" / "Rang dans la série", a pre-existing dictionary key that was defined but never rendered anywhere before this phase) and school (`dict.rankSchoolLabel`, unchanged) — each still using the existing `RankTile` component, which still hides itself entirely (renders nothing) whenever its rank or total is null, so a candidate with a missing school never shows a fake/zero tile. `showRankings` (the section's own visibility gate) was updated to match: it now checks series+school availability instead of national/school/examCenter. No ranking math changed for any candidate — `series`/`school`'s rank computation is byte-for-byte the same as before; only `seriesTotal` is new, and it was verified against live production data (see below) to be internally consistent (e.g. candidate 15049, series SN: rank 2340 of 37280).

### Actions moved (item 7)

`ShareButton` and `DownloadResultPdfButton` moved from a `mt-6` row directly under the average/badge (i.e., above the details grid) to a new `border-t p-5` section directly after `SubjectGradesSection` — same wrapper/spacing pattern already used by the rankings and subject-grades section headers elsewhere in this component, not a new visual pattern.

### Verification performed

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npx eslint . --max-warnings=0` | Passed, zero warnings |
| `npm test` | 203/203 passed (21 files) |
| `npm run build` | Passed (after releasing the Windows Prisma DLL lock held by a stale local dev server on port 3000 — same known, previously-documented issue; the server was stopped, the build re-run clean, and a fresh dev server was started afterward for the live-data checks below, then stopped again before committing) |
| Local dev server against the live production database — `/api/public/search` for one candidate per decision type | ADMIS (15049, SN): `ranks.series=2340, seriesTotal=37280`. REDOUBLE (42942, M): `ranks.series=1628, seriesTotal=2102`. SESSIONNAIRE (54851, SN, found via a read-only Prisma lookup since no SESSIONNAIRE candidate number was already on hand from prior phases): `ranks.series=3970, seriesTotal=37280`. All three returned complete, correctly-shaped JSON with the new `seriesTotal` field populated. |
| Local: `/api/public/candidate-result-pdf` for candidate 15049 | HTTP 200, valid 1-page PDF (confirmed via `file`), unaffected by this phase's changes as expected (PDF still shows national/school/center ranks — that document was not in scope) |
| Local: `/api/public/candidate-grades` for candidate 15049 | Subject list returned correctly, unaffected |
| Local: Arabic (default) and French (`moribac_language=fr` cookie) homepage | `<html lang="ar" dir="rtl">` and `<html lang="fr" dir="ltr">` respectively, both HTTP 200 |
| Live production (`https://mth-bac.vercel.app`), same 3 candidates + PDF + both locales, re-run post-deploy | Every value matched the local pre-deploy result exactly, including the new `seriesTotal` numbers |

**Honest limitation, consistent with every prior UI phase in this project**: this environment has no browser-automation/screenshot tool. The reordered layout, the 2×2 mobile grid, and the conditional message were verified by reading the rendered JSX logic directly (which decision maps to which message, which grid classes apply at which breakpoint) and by confirming every underlying data value (`ranks.series`, `ranks.seriesTotal`, `ranks.school`, `ranks.schoolTotal`, decision, subject grades) is correct end-to-end against live production — not by opening the page in an actual mobile browser. If you have browser tooling available, a real spot-check (ideally on an actual phone, in both Arabic/RTL and French/LTR, for a PASS/FAIL/SECOND-SESSION candidate each) is the one thing this phase could not directly observe, same as noted for every earlier UI phase in this document.

### Deployment

Committed as `08f9b55` and pushed to `main` (git-linked Vercel auto-deploy, same workflow as every prior phase). Deployment `dpl_9eeMcec6EqnsR1rLsRpNioc5bpkX` (target: production), created `2026-07-31T15:46:07Z`, reached `Ready`, aliased to **https://mth-bac.vercel.app** (also `mori-bac.vercel.app`). Live re-verification immediately after (table above) matched the pre-deploy local checks exactly.

---

## Remaining known limitations

1. **11 of the 21 BAC subject codes still have `nameFr: null`** (not guessed, per the operator's explicit instruction): `AF, AT, CH, CM, DM, DS, EL, ME, PH, PI, TA`. Their `nameAr` is confirmed (read directly off the official screenshots), and every coefficient/order/mapping for them is confirmed — only the French display label is missing. Both the web UI and the PDF fall back to the Arabic name (`subjectDisplayName()` in `lib/grades/subject-grades-client.ts`) when `nameFr` is null — verified rendering *correctly* in both places (the PDF specifically needed a per-cell font override, see above, since the fallback text is Arabic script even inside a French document). Not a blocker; resolve when an authoritative French source is available, then re-run `prisma/seed-subject-schemes-2026.ts` (idempotent) and redeploy.
2. **No real mobile/desktop browser was used to verify the result-page UI changes** (auto-shown subjects, new ranking section layout, PDF button placement) — this environment has no browser-automation tool. The underlying logic is verified (tests, live API/PDF data), but an actual visual/device check has not been done. The PDF output, by contrast, *was* verified visually (rendered and rasterized for direct inspection) — that's a stronger form of proof than the web-UI claims above.

## Current final project status

**Live and verified.** The BAC subject-grades feature (full 2026 dataset), the redesigned/reordered result card (name → result+average → conditional message → 2×2 details grid → stream+school rankings → subject grades → actions), automatic (no-click) subject display, the bilingual PDF export, recent searches, and all performance work are all deployed to production at **https://mth-bac.vercel.app** (latest deployment `dpl_9eeMcec6EqnsR1rLsRpNioc5bpkX`). No known data, backend, or PDF-rendering defects remain — every one found in earlier phases (variable-font glyph corruption, an Amiri ligature bug, emoji-in-PDF, mixed-script fallback font, bidi number reordering, footer/pagination overlap) was fixed and re-verified by rendering and visually inspecting the actual output, not assumed fixed.

## Next recommended step (optional, not blocking)

1. **A real-browser spot-check** of the result page (ideally on an actual mobile device), covering what this session could not: rendered CSS layout, browser console errors, and the PDF button's real download behavior in a live browser (the PDF *content* itself is already verified correct).
2. **Resolve the 11 remaining French subject names** (above) if/when an authoritative French-language source becomes available, then re-run the seed script and redeploy.

---

## GitHub Public-Repository Security Audit

**Audit date**: 2026-08-06 (UTC). **Type**: read-only security review (no commits, pushes, visibility changes, deletions, rotations, or deploys performed). **Scope**: current tracked working tree, entire reachable Git history (29 commits, `f063201`..`b539ff7`), `.gitignore` correctness, admin/auth/CSRF/rate-limit/session code, public API PII exposure, `$queryRaw` injection surface, file-upload handling, `npm audit`, repo hygiene (LICENSE/SECURITY.md), and documentation for embedded PII or credentials.

**Verdict: NOT SAFE YET** — safe only after the fixes below are applied. No secret or PII was ever found tracked in Git or in the reachable Git history itself; the blocking issues are (a) real production credentials sitting in an untracked file on disk that must be rotated regardless of Git status, and (b) a few tracked-file/dependency/hygiene items.

**Redacted findings summary**:
- **CRITICAL**: an untracked, gitignored file at the repo root (`VERCEL_ENVIRONMENT.md`) contains the real production `DATABASE_URL`/`DIRECT_URL` (Supabase pooler credentials) and `AUTH_SECRET` in plaintext. Never committed, not in Git history — but it is a live credential on disk and must be rotated as a precaution, then the file deleted or moved outside the repo. Full detail (redacted) given to the operator directly, not repeated here.
- **HIGH**: production dependency `next` is on `16.2.10`, which has several HIGH-severity advisories (middleware/proxy auth bypass, SSRF in Server Actions and rewrites, DoS) fixed in `16.3.0`. `npm audit` confirms a non-major fix is available.
- **MEDIUM**: `BAC2025_ANALYSIS.md` and `README.md` embed a handful of real candidates' full names plus their results (same fields the public app already serves via search, but pasted as static repo content) — recommend anonymizing before publishing. `.claude/`, `.agents/`, and `skills-lock.json` are untracked but not covered by the repo's own `.gitignore` (only one file is, via the operator's personal global gitignore) — a future `git add -A` could commit them. CSP allows `'unsafe-inline'` for script/style. Public candidate-number search is fully enumerable (5-digit numeric, in-memory per-instance rate limit) — pre-existing product design, but worth hardening once the exact logic is public. No root `LICENSE` or `SECURITY.md`.
- **LOW / PASS**: `.env`, `.env.local`, `.env.production` and all `*.xlsx` datasets are correctly gitignored and were never tracked or committed at any point in history; `.env.example` holds only placeholders; every `$queryRaw` call uses parameterized `Prisma.sql`; the public search route explicitly selects only public-safe fields (no birth data, no internal IDs); all 21 admin API routes route through the shared `authorizeMutation` (session + CSRF double-submit + same-origin + live admin re-check); passwords are bcrypt cost 12; error/log output actively redacts connection strings; no hardcoded admin credentials anywhere; Git history contains no large blobs, backups, or datasets (`.git` is 2.5 MB).

**Required cleanup before publishing** (none executed yet — operator approval pending): rotate the Supabase DB password and `AUTH_SECRET`, then delete/relocate `VERCEL_ENVIRONMENT.md`; upgrade `next` to `16.3.0`+; anonymize the real-candidate sample rows in `BAC2025_ANALYSIS.md`/`README.md`; add `.claude/`, `.agents/`, `skills-lock.json` to `.gitignore`; add `LICENSE` and `SECURITY.md`.

**Rotation required**: yes — Supabase DB password and `AUTH_SECRET` (both currently exposed in plaintext in the untracked file above; rotation is warranted independent of Git status).

**Git-history rewrite required**: no — no secret or PII was found in any of the 29 reachable commits; the existing history can be published as-is once the tracked-file/dependency/hygiene fixes above are applied.

**Next approved phase**: none yet — this was a read-only audit. Await explicit operator approval before performing any rotation, file deletion, `.gitignore`/dependency changes, or repository-visibility change.

---

## Credential rotation and production incident — 2026-08-08

Following operator approval, the audit's rotation items were carried out.

**`AUTH_SECRET` rotation**: a new random secret was generated and applied to local `.env` and to Vercel Production + Preview. This immediately invalidates all previously issued admin session cookies (verified from `lib/auth.ts`'s HS256 signature check) — expected, no data impact. `VERCEL_ENVIRONMENT.md` (the file that held the old plaintext credentials, see the audit above) has been deleted from the project directory.

**Supabase database password rotation**: the operator reset the production Supabase password and manually pasted new `DATABASE_URL`/`DIRECT_URL` into Vercel. This caused a **production outage** (`503`, Prisma `"Timed out fetching a new connection from the connection pool"`).

- **Root cause, part 1**: Supabase's dashboard "copy connection string" does not include the query parameters this project's Prisma setup requires — `?pgbouncer=true&sslmode=require&connection_limit=1&pool_timeout=15&connect_timeout=10` for the transaction-pooler `DATABASE_URL` (port 6543), and `?sslmode=require&connection_limit=1&connect_timeout=10` for the session-pooler `DIRECT_URL` (port 5432) — the exact set already documented in `.env.example`. Without `pgbouncer=true`/`connection_limit`, Prisma's default pool exhausts PgBouncer's transaction-mode pool almost immediately in a serverless environment. Fixed by re-appending the documented parameter set to both URLs, preserving the new host/user/password exactly as rotated.
- **Root cause, part 2 (self-inflicted, caught and fixed in the same session)**: the first remediation attempt piped the corrected value into `vercel env add` through a PowerShell pipeline (`Get-Content | npx vercel ...`), which re-encoded/corrupted the string — Vercel logs showed Prisma rejecting it outright (`"the URL must start with the protocol postgresql://"`). Fixed by re-extracting the already-verified-good value from local `.env` (proven correct by a direct Prisma connectivity check) and re-pushing it to Vercel via plain shell stdin redirection (`< file`) instead of a PowerShell pipe, which preserved the string exactly.
- Vercel's `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET` are configured as **Sensitive** environment variables, which are write-only — `vercel env pull` returns a `[SENSITIVE]` placeholder, not the real value, for any of them. Diagnosis therefore relied on structural checks (query-parameter names, port numbers) rather than reading values back, and on Vercel's own runtime logs for the actual Prisma error text.

**Corrected and verified** (redeployed as `dpl_...5xg6rc7s5...`, aliased to `https://mth-bac.vercel.app`):
- Local `.env` `DATABASE_URL`/`DIRECT_URL`: updated to the new password with the full documented parameter set.
- Vercel Production + Preview `DATABASE_URL`/`DIRECT_URL`: same, pushed via `vercel env rm` + `vercel env add < file` (stdin redirect, no interactive prompt, no value ever printed or logged).
- Direct Prisma connectivity check (read-only, ad hoc script, deleted immediately after use): connected in ~1.4s, `ExamYear` rows returned exactly matched the known-good baseline (2024: 47,217 candidates; 2025: 53,148; 2026: 64,532, published/default) — confirms no data was altered.
- Live production: `/api/public/meta` → 200 (0.4s warm), `/` → 200, `/api/public/search?number=15049&year=2026` and `?number=00002&year=2025` both returned the exact known-good candidate records (name/series/average/decision/ranks) documented earlier in this file — full read path confirmed end-to-end.
- All temporary files used to shuttle the new credentials (`new_db_urls.txt` and intermediate temp files in the session scratch directory) were deleted immediately after use; a final sweep confirmed none remain anywhere in the temp directory.

No candidate/result data was read-write touched, no schema or migration was run, no secret value was ever printed to a terminal or written into this document.

---

## GitHub public-repository cleanup — 2026-08-08

Completed the remaining items from the audit above (production behavior untouched — no data, migrations, Supabase config, or Vercel env values were changed in this phase).

**Files changed**:
- `.gitignore` — added `.claude/`, `.agents/`, `skills-lock.json` (in addition to the already-present `VERCEL_ENVIRONMENT.md` rule). Verified via `git check-ignore` that all four now resolve.
- `README.md` — the "Verify candidate 00002" section replaced with a generic, fictional-example verification walkthrough (no real name/wilaya/school).
- `BAC2025_ANALYSIS.md` — the "Candidate present at worksheet row 3" table and the "Sample valid records" table replaced with clearly fictional example rows; the analytical content (column list, cell-type counts, decision/series distributions) is unchanged.
- `package.json` / `package-lock.json` — `next` upgraded `16.2.10` → `16.3.0` (patch, non-major); `"license": "UNLICENSED"` added, reflecting the operator's explicit choice to keep the repository all-rights-reserved (no OSS license file requested).
- `SECURITY.md` — new. Vulnerability-reporting contact and scope, no secrets/PII.
- No `LICENSE` file was added — the operator was asked and chose "all rights reserved / no OSS license."

**Known residual PII (not in this phase's approved scope, flagged for a follow-up decision)**: the same real candidate name redacted from `README.md`/`BAC2025_ANALYSIS.md` still appears in `tests/excel.test.ts`, `IMPLEMENTATION_STATUS.md`, and `scripts/verify-live-api.ts`. Left untouched since the approved scope named only `README.md` and `BAC2025_ANALYSIS.md`.

**Dependency security**: `next@16.3.0` resolves the previously-flagged HIGH-severity Next.js advisories (middleware/proxy auth bypass, SSRF in Server Actions/rewrites, DoS, cache confusion, image-optimization DoS, internal endpoint disclosure) — confirmed absent from a fresh `npm audit --omit=dev`. Four lower-priority findings remain, out of scope for a "Next.js only" upgrade: `brace-expansion` and `nanoid` (transitive, prod dependency tree) and `postcss` (Next.js's own internal/vendored copy, `node_modules/next/node_modules/postcss` — not the project's build-time `postcss`, not attacker-reachable at runtime). None are new; all were already noted in the original audit.

**Verification performed** (all passed): `git status`/`git ls-files` — only the expected files changed, no `.env*`/`.claude`/`.agents`/`skills-lock.json`/`*.xlsx` tracked; current-tree secret scan — only `.env.example` (placeholders) and the known-safe `lib/database-retry.ts` redaction helper and this handoff doc's own prose matched; reachable Git-history secret scan (all commits) — unchanged from the original audit, still only the two already-cleared commits; PII scan for the redacted candidate's name — clean in `README.md`/`BAC2025_ANALYSIS.md`; `npm audit --omit=dev` — 4 findings, none Next.js-specific (see above); `npm run typecheck` — passed; `npx eslint . --max-warnings=0` — passed, zero warnings; `npm test` — 203/203 passed (21 files); `npm run build` — passed, full route manifest generated.

**Git**: committed and pushed to `origin/main` on the existing **private** repository. Repository visibility was not changed.

**Next approved phase**: a final audit pass (re-run the same tree/history/PII/secret checks against the freshly pushed `main`, plus a decision on the three residual-PII files noted above) followed by explicit operator approval to flip the repository to public.

---

## Residual-PII cleanup — 2026-08-08 (follow-up)

Redacted the three files flagged in the prior phase: `tests/excel.test.ts` (the real-workbook test now checks `fullName` structurally — non-empty string containing an apostrophe, still exercising the same encoding edge case — instead of asserting the literal real name; every other official field is still checked exactly against the real, untracked `BAC2025.xlsx`), `scripts/verify-live-api.ts` (dropped `fullName` entirely from its three year-fixtures — 2021/2024/2025 each previously carried a different real candidate's name — and replays the same non-empty-string check against live production; every count/ranking/pagination/cancellation assertion this ops script performs against real deployed data is unchanged), and `IMPLEMENTATION_STATUS.md` (same generic fictional-example rewrite already applied to `README.md`).

A broader sweep (grepping the full tracked tree for all six real names now known, plus a generic `fullName: "..."`-shaped scan across `scripts/`) found no further occurrences.

**Important caveat on Git history**: the current tree (`HEAD`) is now clean of all six known real candidate names. The **reachable history is not** — these names were introduced in the very first commit (`f063201`, which added `README.md`/`BAC2025_ANALYSIS.md`/`IMPLEMENTATION_STATUS.md`/`tests/`) and touched again in two later commits (`3a5323e`, `b8ae874`) before this cleanup. Redacting a file in a new commit does not remove the old value from history — it remains readable via `git log -p`/`git show <old-commit>` and, once pushed, via GitHub's own history browser, for as long as the repository's history is public. This is real personal data (names tied to real academic results), not a credential — no rotation applies — but it is a genuine residual exposure if the goal is that this data never appear in the public repo at all, including history. Resolving it requires an explicit decision: rewrite/squash history (e.g. `git filter-repo`) before making the repository public, or accept it as a known, low-severity residual (the same data is independently, individually retrievable by anyone through the app's own public search feature — this only concerns the *bulk, at-a-glance* visibility of a handful of names inside old diffs). Not resolved in this phase — flagged for the operator's decision before the public-release approval.

**Verification performed** (all passed): current-tree secret scan — same three expected safe matches as the prior phase (`.env.example`, `lib/database-retry.ts`, this handoff doc's own prose); reachable Git-history secret-pattern scan — still only the two pre-existing cleared commits plus this phase's own commit (prose only, no real secret); the six-name PII scan — clean on current tree, present only in pre-cleanup history commits as described above; `npm run typecheck` ✅; `npx eslint . --max-warnings=0` ✅ zero warnings; `npm test` ✅ 203/203 (21 files, including the modified real-workbook test); `npm run build` ✅ full route manifest; `npm audit --omit=dev` — unchanged from the prior phase, 4 findings (`brace-expansion`, `nanoid`, `postcss` nested under Next.js's own vendored copy — none newly introduced, none Next.js-direct).

**Git**: committed and pushed to `origin/main` on the existing **private** repository. Repository visibility was not changed.

**Next approved phase**: operator decision on the Git-history PII caveat above, then a final confirmation audit, then explicit approval to flip the repository to public.

---

## Standing rules for whoever continues this work

- Never guess or invent academic data (subject names, coefficients, display order, any official BAC rule). If something can't be confirmed from an authoritative source, stop and ask.
- Never apply migrations, seed, import grades, or deploy without explicit operator approval, one step at a time.
- Never put database credentials, connection strings, or candidate PII into a committed file. Backups and raw extracted datasets belong outside this git repository.
- This file should be updated (not left stale) as soon as the next phase completes.
