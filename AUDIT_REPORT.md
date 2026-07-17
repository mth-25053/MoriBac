# MoriBac Project Audit

Audit date: 2026-07-15

Scope: `PROJECT_SPEC.md`, `README.md`, `package.json`, Prisma schema and migration, `.env.example`, all files under `app/`, `components/`, `lib/`, `scripts/`, and `tests/`, every API and admin route, authentication, Excel import, database access, the live development server, and the reported Windows/Prisma errors.

Verification performed before this report was created:

- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings.
- `npm test` — failed in the restricted Windows sandbox because Vite could not spawn a child process; rerun outside that sandbox and all 8 existing tests passed.
- `npx prisma generate` — failed with `EPERM` while renaming `query_engine-windows.dll.node`.
- `npx prisma migrate dev` — failed because `DIRECT_URL` is not defined. There is no local `.env` file.
- `npm run build` — failed at its first `prisma generate` step with the same `EPERM`.
- Live server checks — `/` returned 200 with Arabic `lang="ar"` and `dir="rtl"`; `/admin/login` returned 200; `/api/public/meta` returned 500 without a database connection.
- Process/port inspection — Node PID 22048 is listening on port 3000 and is connected to Node worker PID 13164. These are the active Next.js processes associated with the Prisma engine lock. Additional parent/wrapper Node processes are PIDs 17560 and 21804. Windows denied access to their full command lines.

## Completed and working

Only behavior personally verified during this audit is included here.

| Feature name | Relevant files | Current status | Exact problem | Required fix | Priority |
|---|---|---|---|---|---|
| Strict TypeScript compilation | `tsconfig.json`, all `.ts`/`.tsx` files | `npm run typecheck` passes | None in the currently generated type surface | Keep it passing after repairs | Medium |
| ESLint quality gate | `eslint.config.mjs`, all source files | `npm run lint` passes with zero warnings | The `react-hooks/set-state-in-effect` rule is disabled globally, so the pass does not validate that class of React behavior | Avoid new violations; reconsider the override when client effects are refactored | Low |
| Existing unit tests | `tests/excel.test.ts`, `tests/results.test.ts`, `vitest.config.ts` | 8 tests pass outside the restricted Windows process sandbox | Coverage is narrow and mostly tests pure helpers and generated workbooks | Expand coverage as listed below | High |
| Arabic default document shell | `app/layout.tsx`, `lib/i18n.ts`, `app/page.tsx` | Live `/` returns 200 with `lang="ar"` and `dir="rtl"` | Database-driven homepage content cannot load without PostgreSQL | Retest the complete page after database setup | High |
| Admin login page shell | `app/admin/login/page.tsx`, `components/admin/login-form.tsx` | Live `/admin/login` returns 200 | Real login cannot be tested without the database, secret, migration, and admin row | Configure database, migrate, create admin, then run an end-to-end login test | Critical |
| Static candidate formatting helpers | `lib/format.ts`, `components/result-card.tsx`, `components/results-list.tsx` | Existing unit/compiler checks prove two-decimal formatting compiles and the helper returns the specified shape | No direct formatting/translation tests exist | Add explicit average and decision-translation tests | Medium |

## Implemented but not verified

These features have substantive code, but the current environment or test coverage does not prove that they work end to end.

| Feature name | Relevant files | Current status | Exact problem | Required fix | Priority |
|---|---|---|---|---|---|
| PostgreSQL/Prisma data model | `prisma/schema.prisma`, initial migration | Models exist for admins, years, candidates, batches, import errors, settings, and login throttles | Schema generation is currently blocked by a locked DLL; validation has not yet completed in the repaired environment; migration has not run against a real database | Clear the lock, format/validate/generate, then migrate a valid PostgreSQL database | Critical |
| Candidate number storage and indexes | `prisma/schema.prisma`, migration | Candidate number is `String`/PostgreSQL `TEXT`; uniqueness is per exam year; requested field indexes exist | No real database has proved constraints or leading-zero round trips | Migrate and run integration tests with `00002` and the official workbook | Critical |
| Signed administrator sessions | `lib/auth.ts`, `lib/http.ts`, protected admin layout | HMAC JWT session, HttpOnly cookie, production `Secure`, SameSite, origin and CSRF checks are implemented | No successful login/session/API lifecycle has been run; sessions do not re-check that the admin still exists | Add database-backed auth integration tests and optionally revalidate the admin per privileged request | Critical |
| Failed-login throttling | `lib/security.ts`, `LoginThrottle` model | Database-backed attempt/window/block logic exists | No database test proves blocking, reset, or concurrent updates | Add integration tests and make failure increments atomic if required | High |
| First-admin creation | `scripts/create-admin.ts`, `prisma/seed.ts` | bcrypt cost 12 and upsert scripts exist; README documents commands | Cannot run until database credentials and migrations exist | Retest against the configured database and document both interactive and seed paths precisely | Critical |
| Public candidate search | `app/api/public/search/route.ts`, `components/home-experience.tsx` | Exact composite lookup and no-reload client fetch are implemented; public select omits birth fields | API currently returns 500 indirectly because PostgreSQL is unavailable; no not-found or `00002` API test | Configure/import/publish BAC 2025 and add route/integration tests | Critical |
| Browse priority query shape | `lib/results.ts`, public results API | Pure tests prove school → center → series where-clause priority | No database-backed proof of Top 10 ordering, all-series center/school behavior, pagination, or totals | Add repository/integration tests using real BAC 2025 records | Critical |
| Server pagination and statistics | `lib/results.ts`, `components/statistics.tsx` | 50-row center/school pagination and server aggregate queries exist | Not run against a database; `failed` counts only `REDOUBLE`, so treatment of `ABSENT` needs an explicit product rule | Verify with real data and document/count absent candidates consistently | High |
| Multi-year publication UI | admin results page, year API, `ExamYear` model | Publish, hide, set-default, and delete controls exist | No database test; database does not enforce a single default; year deletion error is swallowed | Add transactional integration tests and honest error responses | Critical |
| Generic Excel preview/import | `lib/excel.ts`, preview/commit APIs, import client | File-size check, aliases, row validation, checksum, preview, duplicate-in-file check, transaction, and draft publication state exist | It has only been tested with synthetic workbooks and has not been matched to `BAC2025.xlsx` | Analyze the real workbook and adapt aliases/types/decisions without mock assumptions | Critical |
| Arabic/French dictionaries | `lib/i18n.ts`, `lib/admin-i18n.ts` | Main public/admin labels and result decisions exist in both languages | No complete UI audit or automated coverage proves every visible/error string is translated | Replace remaining hard-coded strings and add dictionary completeness tests | High |
| Theme behavior | `app/layout.tsx`, `components/theme-switcher.tsx`, CSS | System detection, manual toggle, cookie/localStorage persistence are implemented | Not browser-tested for first paint, persistence, both themes, or contrast | Add browser/manual checks and correct any hydration/icon flash | Medium |
| Mobile/desktop result presentation | results list, result card, CSS | Mobile cards and desktop table branches exist | No viewport or overflow test has been performed | Run responsive browser tests at representative widths | High |
| SEO/error pages/security headers | layout metadata, robots, sitemap, 404, error page, Next config | Implementations exist | Metadata has an encoding defect on the About page and production canonical URLs are unverified | Fix encoding and validate rendered metadata/headers on a production build | Medium |
| Caching/performance strategy | public APIs, Prisma indexes, Next configuration | Shared-cache headers, database-only searches, and server pagination exist | No real-data latency, cache, or query-plan measurements exist | Test after import; inspect slow queries and payload sizes | Medium |

## Broken or incomplete

| Feature name | Relevant files | Current status | Exact problem | Required fix | Priority |
|---|---|---|---|---|---|
| Windows Prisma generation | `node_modules/.prisma/client`, active Next.js processes | Broken and reproduced | `npx prisma generate` fails with `EPERM` renaming the Windows query-engine DLL while the live Next.js process on PID 22048/worker 13164 holds it | Stop only the project’s Node/Next process tree, regenerate, and record the locking process | Critical |
| Environment configuration | `.env.example`, absent `.env` | Incomplete | No `.env` exists and none of the required variables are present in the current shell | Improve examples/failure messages; user must supply real PostgreSQL/Supabase credentials and a secret | Critical |
| Database migration | Prisma datasource and scripts | Broken and reproduced | `prisma migrate dev` stops at missing `DIRECT_URL`; no database is usable | Do not migrate until both real URLs are supplied; then validate and deploy migrations | Critical |
| Production build | `package.json` build script | Broken in current state | Build stops at the locked Prisma generation step | Resolve the project process lock and rerun the full build | Critical |
| Live public data APIs | public API routes | Broken in current state | `/api/public/meta` returns 500 because no PostgreSQL database is configured | Provide clear operational error handling and connect/migrate/import/publish the database | Critical |
| Official BAC 2025 compatibility | `BAC2025.xlsx`, `lib/excel.ts` | Incomplete | The real workbook has never been analyzed; current aliases assume a synthetic first-row schema | Produce `BAC2025_ANALYSIS.md` and update parsing for its exact sheets/columns/types/values | Critical |
| Import-error persistence | `ImportError` model, preview/commit routes | Disconnected | The table exists but no code ever creates an `ImportError`; invalid previews and rejected commits leave no batch/error audit trail | Persist validation/import failure reports with a clear batch lifecycle | High |
| Import lifecycle/status | `ImportStatus`, commit API, history UI | Incomplete | `VALIDATED` and `FAILED` are never written; every successful commit is immediately marked `IMPORTED`; history cannot show preview/validation failures | Define and implement lifecycle transitions and translated status labels | High |
| Import batch undo/delete | schema, admin routes/UI | Missing behavior required by the attached task | No endpoint or UI can safely undo a specific batch; candidate relation currently restricts batch deletion | Add a protected, transactional batch deletion that only removes its candidates/log/errors and handles publication safely | High |
| Import response size and error report | preview API and import client | Incomplete | Preview returns every validation error including raw row data, potentially producing a very large response; UI only renders the first 100 | Return summary plus bounded error samples/download strategy while persisting the full report | Medium |
| File validation consistency | preview and commit routes | Incomplete | Preview checks only `.xlsx` filename; commit does not repeat extension/MIME checks; neither checks the ZIP signature explicitly | Centralize file validation and revalidate type/size/signature at both steps | High |
| Year deletion correctness | year API | Broken error handling | `DELETE` catches all Prisma errors and still returns `{ok:true}`, so the UI can report deletion when nothing was deleted | Return 404/409/500 appropriately and cover cascading behavior with integration tests | High |
| Browse Top 10 ordering | `lib/results.ts`, home sort selector | Violates the exact requirement | A user can choose lowest/name/number while only a series is selected, so the displayed ten are not necessarily the highest averages | Force average-desc Top 10 until center/school mode; expose sorting only for detailed lists | High |
| Center option independence from series | `getFilterOptions` | Incomplete mandatory logic | Center options are filtered by the selected series even though selecting a center must ignore series and show every series; valid centers can be hidden | Derive centers from year + wilaya, not series; derive schools from year + center | High |
| Settings connection | settings page/API, public pages | Disconnected | Notices are stored but never read or displayed anywhere public | Either surface localized notices or redefine settings to control an actually consumed application value | Medium |
| Translation completeness | API errors, loading labels, settings toast, navigation labels, preview keys | Incomplete | Several user-visible labels/errors are hard-coded in English (`Loading`, `Primary`, `Error`, API messages, field keys) | Move all visible/error text to locale dictionaries or stable translated error codes | High |
| About metadata encoding | `app/about/page.tsx` | Broken | Title is corrupted as `أ€ propos` instead of `À propos` | Correct UTF-8 text and add an encoding scan/test | Medium |
| Public error states | home client and public APIs | Incomplete | Browse fetches do not check `response.ok`; database/network failures can produce a blank or malformed state rather than an accessible error | Add explicit localized error state and retry behavior | High |
| Duplicate CSRF browser helper | `lib/auth.ts`, `lib/csrf-client.ts` | Incomplete cleanup | A `document`-dependent helper remains duplicated in the server auth module | Remove the server-module copy and keep the client-only helper | Low |
| Accessibility verification | forms/components/CSS | Partially implemented | Semantics and focus styles exist, but no keyboard, screen-reader, contrast, or reduced-motion audit was run; some aria labels remain English | Run automated/manual accessibility checks and translate labels | Medium |
| README operational accuracy | `README.md` | Incomplete | It assumes credentials exist, does not explain the Windows DLL lock, does not describe the actual BAC file, and cannot yet provide verified `00002` steps | Update after environment repair and workbook analysis | High |

## Missing

| Feature name | Relevant files | Current status | Exact problem | Required fix | Priority |
|---|---|---|---|---|---|
| Real BAC 2025 analysis report | `BAC2025.xlsx` | Missing | No sheet/row/column/type/value/duplicate/encoding analysis exists | Create `BAC2025_ANALYSIS.md` from the actual workbook | Critical |
| Real BAC 2025 import verification | importer, database, workbook | Missing | No official row has been validated, imported, searched, browsed, or statistically aggregated | After credentials are supplied, migrate, import as draft, inspect, publish manually, and verify exact records | Critical |
| Candidate `00002` end-to-end proof | search/import/database | Missing | No test proves the official candidate survives Excel → PostgreSQL → public API with leading zeros | Add workbook assertion now and database/API verification after credentials are available | Critical |
| Database integration test harness | tests | Missing | All existing tests avoid PostgreSQL and Prisma data operations | Add isolated database integration tests or transaction-backed test setup | High |
| Candidate-not-found test | tests | Missing | Required behavior has no route/component test | Add public search API test | High |
| Top-10-by-series data test | tests | Missing | Only the generated `where` object is tested | Seed/query representative or official data and assert count/order | High |
| Center-all-series data test | tests | Missing | Query shape alone does not prove returned rows or pagination | Add repository/API integration test | High |
| School-all-series data test | tests | Missing | Query shape alone does not prove returned rows or pagination | Add repository/API integration test | High |
| Valid import transaction test | tests | Missing | Parser tests do not test `ImportBatch`, candidates, or rollback | Add database/API import integration test | High |
| Duplicate-file test | tests | Missing | Checksum uniqueness code has no test | Import the same bytes twice and assert 409/no extra rows | High |
| Admin route protection test | tests | Missing | Protected layout/API authorization is untested | Test anonymous, invalid-session, missing-CSRF, and valid-admin cases | Critical |
| Decision translation test | tests | Missing | Dictionary values are untested | Assert every enum has Arabic and French output | Medium |
| Average formatting test | tests | Missing | No explicit `13.47 /20` assertion | Add unit/component test | Medium |
| Pagination test | tests | Missing | Skip/take/page counts are untested | Add data-level tests across more than 50 records | High |
| Filter dependency data tests | tests | Missing | Wilaya → center and center → school contents are untested | Add repository/API tests using real distinct values | High |
| Import batch undo test | tests | Missing | The feature itself does not exist | Implement and test atomic deletion and failure rollback | High |
| Final implementation status report | repository root | Missing | Required handoff report does not exist | Create `IMPLEMENTATION_STATUS.md` after all non-blocked work and verification | High |
| Browser-level responsive/theme/language tests | tests | Missing | Persistence, RTL/LTR switching, dark/light modes, mobile overflow, and public interactions are not exercised | Add browser tests if feasible and record manual verification | Medium |
| Clear runtime configuration failure page/message | database bootstrap/runtime | Missing | With no database, public metadata returns a generic 500 and the client hides the cause | Add safe server logs and localized user-facing service-unavailable behavior without leaking credentials | High |

## Audit conclusion

The repository contains a substantial application skeleton and several sound architectural choices, but it is not currently usable with real results. The immediate critical path is: stop the project-specific Next.js process that locks Prisma, regenerate/validate Prisma, obtain real PostgreSQL/Supabase credentials, analyze and adapt to `BAC2025.xlsx`, repair import auditability/undo and exact browse behavior, expand tests, then perform a real database import and public/admin verification. No database credentials should be invented or committed.
