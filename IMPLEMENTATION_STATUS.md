# MoriBac Implementation Status

Status date: 2026-07-16

## What was already present

Before this repair pass, the project already contained:

- Next.js App Router, TypeScript, Tailwind CSS, and Prisma/PostgreSQL scaffolding.
- Public Arabic/French shell, RTL/LTR layout, theme and language switchers.
- Candidate search, result card, result browsing UI, mobile cards, desktop tables, pagination controls, and statistics cards.
- Prisma models for admins, exam years, candidates, import batches/errors, settings, and login throttles.
- Signed administrator sessions, bcrypt password hashes, HttpOnly/Secure cookie settings, CSRF/origin checks, and failed-login throttling code.
- Administrator dashboard, Excel page, year management, history, settings, and logout UI.
- A generic ExcelJS parser, synthetic parser tests, initial migration, admin scripts, README, and `.env.example`.

The pre-change evidence and gaps are preserved in [AUDIT_REPORT.md](AUDIT_REPORT.md).

## What was repaired

- Identified the Windows Prisma lock as the running Next.js server on port 3000 (PID 22048, connected worker PID 13164), stopped only that project server, and successfully regenerated Prisma Client.
- Reproduced the missing-`DIRECT_URL` migration failure and documented all required variables without creating credentials.
- Ran `prisma format`, `prisma validate`, and `prisma generate` successfully.
- Analyzed all 53,148 real rows in `BAC2025.xlsx`; see [BAC2025_ANALYSIS.md](BAC2025_ANALYSIS.md).
- Added the actual official column aliases: `NUMBAC`, `NOM`, `MoyBac`, `CentreExamen`, and the existing official forms.
- Added official decision `ANNULE` to Prisma, migrations, validation, types, Arabic/French translations, badges, preview, and tests.
- Preserved five-character candidate numbers as text and verified `00002` directly from the official workbook.
- Normalized repeated whitespace in names/filter values without changing distinct center/school counts.
- Added consistent extension, MIME, size, ZIP-signature, column, row, average, decision, duplicate, and checksum validation.
- Made validation create/update `VALIDATED` or `FAILED` import logs and persist `ImportError` rows.
- Bounded preview responses to the first 20 valid rows and first 100 displayed errors while retaining full database logs.
- Reworked imports into 1,000-row chunks inside a 120-second PostgreSQL transaction to avoid bind-parameter limits; failures roll back candidates and mark the batch failed.
- Prevented duplicate checksum imports and revalidated the checksum/file at commit time.
- Added protected transactional batch undo, including candidate/error deletion and cleanup of an empty draft year; published years must be hidden first.
- Corrected exact public priority: school, then center, then average-descending series Top 10.
- Prevented wilaya-only selection from changing Top 10 and stopped series from restricting center choices.
- Made dependent filter loading incremental: series → wilaya → centers in wilaya → schools in center.
- Restricted detailed sorting to center/school mode and kept Top 10 permanently average-descending.
- Added explicit localized public database/network error and retry states.
- Connected localized site notices from administrator settings to the public homepage without locale-unsafe shared caching.
- Rechecked that privileged mutations reference an existing administrator, not only a signed client token.
- Fixed silent year-deletion success, prevented publishing empty years, and added safe database errors.
- Removed the duplicate browser-only CSRF helper from the server authentication module.
- Corrected corrupted About metadata and remaining visible/ARIA/preview translations addressed during the audit.
- Added clear environment validation and safer Supabase/Windows setup documentation.
- Created `.env` automatically, generated a 96-character local `AUTH_SECRET`, and fixed `npm run env:check` so it loads `.env` before validation.
- Added `BAC*.xlsx` to `.gitignore` because the workbook contains private birth data and must not be committed or deployed.

## What was added

- `AUDIT_REPORT.md`
- `BAC2025_ANALYSIS.md`
- `IMPLEMENTATION_STATUS.md`
- Official workbook analysis command: `npm run excel:analyze`
- Environment checker: `npm run env:check`
- `ANNULE` migration: `prisma/migrations/20260715133500_add_annule_decision/migration.sql`
- Import validation/log service: `lib/import-batches.ts`
- Safe database error helper: `lib/database-errors.ts`
- Protected import-batch deletion API and translated history UI
- Schema-independent Excel architecture: `HeaderDetector`, `HeaderNormalizer`, `AliasMatcher`, `ExcelImporter`, `MappingRepository`, and bilingual `MappingWizard`.
- Persistent `ExcelMapping` migration with normalized structure signatures and automatic mapping reuse.
- Nullable optional candidate fields plus persisted `candidateType`.
- Expanded tests for unrelated workbook layouts, fuzzy aliases, manual/saved mapping, optional NULL values, official workbook parsing, leading zeros, duplicate handling, browsing, pagination, protection, translations, and formatting

## Verified results

| Check | Result |
|---|---|
| `npx prisma format` | Passed |
| `npx prisma validate` | Passed with configured Supabase PostgreSQL |
| `npx prisma generate` | Passed after stopping the locking Next.js process |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test` | 28/28 passed across 4 files |
| Real `BAC2025.xlsx` parse | 53,148 valid, 0 invalid, 0 duplicate candidate numbers |
| Candidate `00002` parser assertion | Passed with leading zeros and expected official fields |
| `npm run build` | Passed with the configured production environment |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| Built homepage | HTTP 200, Arabic default, RTL |
| French/dark preference smoke check | HTTP 200, French, LTR, `dark` class |
| Supabase migrations | Both checked-in migrations applied successfully |
| Administrator | Created from one-time seed credentials; plaintext seed values removed afterward |
| Official import | 53,148 candidates committed in one completed import batch |
| Publication | BAC 2025 published and set as default |
| Live public verification | Candidate `00002`, all seven Top 10 lists, center/school priority, pagination, and statistics passed |
| Schema-independent mapping verification | Unknown structure opened wizard contract; manual mapping persisted; second workbook reused it automatically |

## What still requires user input

Nothing is required for local development or database operation. Supabase is migrated, the administrator exists, BAC 2025 is imported and published, and live public queries pass. A real canonical HTTPS `NEXT_PUBLIC_APP_URL` is only required when deploying to the final production domain.
## Required environment variables

The configured `.env` now contains the required database URLs, session secret, and local application URL. One-time seed credentials were removed after the administrator password was hashed and stored.

Validate configuration without printing values:

```powershell
npm run env:check
```
## Exact database commands

The database was prepared with:

```powershell
npx prisma validate
npx prisma generate
npm run db:deploy
```

Do not run migrations with placeholder URLs. `db:deploy` applies both checked-in migrations. Use `npm run db:migrate -- --name description` only for a future development schema change.

## Exact administrator command

```powershell
npm run admin:create -- admin@example.mr "a-strong-unique-password-with-12-or-more-characters"
```

Or set the seed variables, run `npm run db:seed` once, then remove the seed password from the environment.

## Exact BAC2025 import steps

1. Run `npm run dev`.
2. Sign in at `http://localhost:3000/admin/login`.
3. Open **Import Excel**.
4. Select year `2025` and `BAC2025.xlsx`.
5. Validate and confirm: 53,148 total, 53,148 valid, 0 invalid.
6. Review the first 20 rows and commit as draft.
7. Inspect BAC 2025 under **Manage results**.
8. Publish manually.
9. Set BAC 2025 as the default year.

The official file must remain outside Git/deployment artifacts.

## Verify candidate 00002

After import and publication:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/public/search?number=00002&year=2025'
```

Expected fields include:

- `candidateNumber`: `00002`
- `fullName`: `[REDACTED CANDIDATE NAME]`
- `series`: `M`
- `average`: `8.47`
- `decision`: `SESSIONNAIRE`
- `wilaya`: `Trarza`
- `examCenter`: `Lycée Rosso`
- `school`: `Rosso Candidat Libre`

The response must not contain birth date or birth place.

## Known limitations

- Database-backed end-to-end verification is complete. Supabase pooler connections showed occasional transient resets during sustained verification; API verification includes bounded retries, and the direct/session URL remained stable for migrations and administrative diagnostics.
- The official import is intentionally a long-running administrator operation. The route requests up to 300 seconds; confirm the Vercel plan supports the duration/memory needed for 53,148 Excel rows, or run the same application/import against PostgreSQL from a controlled Node host.
- No full browser automation package is installed. Responsive layout, semantic structure, focus styles, cookie-driven French/LTR/dark rendering, and reduced-motion CSS were inspected/smoke-tested, but a final screen-reader and physical-device pass is still recommended.
- Import history displays the latest 100 batches; the specification does not require history pagination, but it may be useful after many years.

## 2026-07-21 stabilization pass

A maintenance pass to prepare the project for a stable production release, without changing any business rule, feature, or authentication behavior:

- Fixed a stray uncommitted typo in `scripts/check-env.ts` (`DIREzCT_URL`) that would have silently disabled `DIRECT_URL` validation.
- Fixed mojibake (double-encoded UTF-8) in `components/admin/import-client.tsx` (garbled Arabic/French error strings, ellipsis, dash, and separator characters) and in this file and `README.md` (garbled example output).
- Deduplicated the accent/diacritic normalization logic: `lib/excel/excel-importer.ts` now reuses `HeaderNormalizer.normalize` instead of an identical private copy.
- Broadened the Excel column-alias list (`lib/excel/alias-matcher.ts`) with more English/French/Arabic synonyms per field, purely additively — existing saved mappings (keyed by structure hash) are unaffected. Added a regression test proving a brand-new, reordered, Arabic-header workbook layout is auto-recognized without a manual mapping.
- Added SEO metadata: canonical URLs, Open Graph `siteName`/`url`, Twitter card, `WebSite` structured data (JSON-LD), keywords, `robots.ts` `host` field and full `/api/*` disallow, and `lastModified` in `sitemap.ts`.
- Added security headers that don't affect authentication or app behavior: HSTS, `X-DNS-Prefetch-Control`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and an explicit `object-src 'none'` in the CSP.
- Added `ARCHITECTURE.md` documenting the request flow, data model, Excel pipeline, ranking rules, security model, and i18n model.
- Verified `typecheck`, `lint` (zero warnings), the full test suite (43/43, up from 42), `npm run build`, `npm run env:check`, and `npm audit` (0 vulnerabilities) all pass after every change.
