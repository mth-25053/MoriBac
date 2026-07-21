# MoriBac Architecture

This document describes how the application is put together. It is a companion to `README.md` (setup/operations) and does not duplicate environment or deployment steps.

## 1. High-level shape

MoriBac is a single Next.js 16 (App Router) application with three layers:

- **Public site** — server-rendered pages (`/`, `/about`) that read the requested locale/theme from cookies, plus a client-side "experience" component that talks to read-only, cached JSON endpoints under `/api/public/*`.
- **Admin area** — `/admin/*`, gated by `app/admin/(protected)/layout.tsx` (`requireAdmin()`), plus mutating JSON endpoints under `/api/admin/*` that all funnel through a single authorization helper.
- **Excel import pipeline** — a schema-independent parser (`lib/excel/*`) that turns an arbitrary `.xlsx` workbook into validated candidate rows, decoupled from any specific year's column layout.

`proxy.ts` (the Next.js 16 replacement for the historical `middleware.ts` convention) does a cheap, cookie-presence-only redirect for unauthenticated `/admin/*` requests; it is a UX fast-path only. The real authorization boundary is server-side: `requireAdmin()` verifies the signed session, and every admin API route re-validates the session, CSRF token, and admin existence independently of the proxy.

## 2. Directory layout

```
app/                    Next.js App Router: pages, layouts, and route handlers
  admin/login           Public login page
  admin/(protected)/*   Admin dashboard, import, results, history, settings (behind requireAdmin())
  api/public/*          Unauthenticated, cached, read-only JSON endpoints
  api/admin/*           Authenticated, CSRF-protected, mutating JSON endpoints
components/             React components (public UI + components/admin/* for the dashboard)
lib/                    All business logic, cross-cutting concerns, and the Excel engine (lib/excel/*)
prisma/                 schema.prisma, migrations, one-time seed script
scripts/                Operational tooling (env check, admin creation, workbook analysis, live verification) — not part of the running app
tests/                  Vitest suites
```

Business logic never lives in a route handler beyond request parsing/response shaping — it lives in `lib/*` so it can be unit-tested without an HTTP layer (see `tests/*.test.ts`, all of which import from `lib/` or `components/`, not from `app/api/*`).

## 3. Data model

`prisma/schema.prisma` is the source of truth. In summary:

- `Admin` — administrator accounts (bcrypt password hash).
- `ExamYear` — one row per BAC year, with `isPublished`/`isDefault` flags controlling public visibility.
- `Candidate` — the result record. `candidateNumber` is always `TEXT` (never coerced to a number, so leading zeros survive). `decision` is a fixed enum (`ADMIS`/`SESSIONNAIRE`/`REDOUBLE`/`ABSENT`/`ANNULE`); `officialDecision` separately preserves the exact source text (e.g. a descriptive cancellation reason) for audit purposes. All fields except number/name/series/average/decision are nullable.
- `ImportBatch` / `ImportError` — one row per validated/committed workbook, with a unique SHA-256 `checksum` (prevents re-importing the same file) and per-row validation failures.
- `ImportUpload` / `ImportUploadChunk` — temporary storage for chunked client-side uploads of workbooks too large for a single serverless request body.
- `ExcelMapping` — a column mapping persisted by `structureKey` (a hash of the detected header row), so a workbook layout only needs to be mapped once (automatically or via the wizard) and is recognized automatically afterward.
- `Setting` — small key/value store (currently the bilingual homepage notice).
- `LoginThrottle` — database-backed failed-login tracking.

## 4. Excel import pipeline

Goal: never hard-code a workbook, a year, or a column position. The pipeline (`lib/excel/*`) has five stages:

1. **`HeaderDetector`** scans every worksheet's first ≤50 rows and scores each row as a candidate header row (weighted by how many required fields it can match, column/text density, and proximity to the top). The best-scoring row/sheet is selected — no fixed row or sheet index.
2. **`HeaderNormalizer`** strips accents/diacritics, uppercases, and removes non-alphanumeric characters, so `"Numéro_du candidat!"` and `"NUMERO DU CANDIDAT"` normalize to the same key.
3. **`AliasMatcher`** compares each normalized header against a curated English/French/Arabic alias list per canonical field, using exact match, Levenshtein similarity, and a containment heuristic (with trailing `_FR`/`_AR`/`_EN` language-suffix stripping). Matches are accepted above a similarity threshold, best-score-first, each column used at most once.
4. If a required field's column can't be resolved with confidence, the API returns `mappingRequired: true` and the admin resolves it via the bilingual **Mapping Wizard**. The confirmed mapping is persisted in `ExcelMapping`, keyed by a hash of the column structure — so the same layout is recognized automatically on every later upload, without ever hard-coding that structure into source code.
5. **`ExcelImporter.import()`** walks every data row, validates required fields/average range/decision text, flags in-file duplicate candidate numbers, and maps free-text decision values (including localized and descriptive variants, e.g. a French sentence explaining why an exam was cancelled) onto the fixed five-value decision enum while preserving the original text in `officialDecision`.

Because matching is column-name-driven rather than position-driven, a future workbook can reorder columns, rename them, add new (ignored) columns, drop optional columns, or change capitalization/accents/language — the pipeline keeps working, and only requests manual input when it genuinely cannot identify a *required* field with confidence. This is covered by a dedicated test (`tests/excel.test.ts`, "auto-recognizes a future workbook with reordered columns, Arabic headers...") that simulates a workbook layout the system has never seen.

Import itself is a two-step **preview → commit** flow: preview parses and persists a `VALIDATED`/`FAILED` `ImportBatch` plus any `ImportError` rows but writes no candidates; commit re-parses the same bytes, re-verifies the checksum matches what was previewed, and only then inserts candidates inside a single database transaction (chunked to stay under bind-parameter limits), marking the batch `IMPORTED`. Nothing is ever published automatically — publishing an `ExamYear` is a separate, explicit admin action.

## 5. Ranking, browsing, and statistics

`lib/results.ts` implements one rule set, used identically by Top 10 and the detailed browse view:

```
school selected  → all candidates in that school (any series)
center selected  → all candidates in that center (any series)
only series set  → Top 10 of that series, strictly average-descending
nothing selected → no query
```

Every ranking/statistics query excludes `decision: ANNULE` (cancelled exams) — they remain individually searchable by candidate number but never appear in a ranking, a Top 10, or an outcome count. `lib/decision.ts` centralizes the small amount of decision-dependent presentation logic (rank suppression, badge styling) so it isn't duplicated across components.

## 6. Authentication & security model

- Sessions are HS256 JWTs (`jose`), `HttpOnly`/`Secure`(prod)/`SameSite=Lax`, 8-hour expiry, verified server-side on every request that needs one (`lib/auth.ts`).
- A separate, non-`HttpOnly` CSRF cookie must be echoed back in an `x-csrf-token` header on every mutation, compared with a timing-safe equality check, alongside a same-origin (`Origin`/`Host`) check (`lib/security.ts`, `lib/http.ts`).
- `authorizeMutation()` (`lib/http.ts`) is the single choke point every admin API route calls: it re-checks the database for the admin's continued existence on every privileged request, rather than trusting the JWT alone.
- Login is throttled at the database level (`LoginThrottle`), keyed by IP+email, and compares against a fixed dummy bcrypt hash when the account doesn't exist, to keep failure timing similar between "wrong password" and "no such account."
- `next.config.ts` sets CSP, frame-denial, HSTS, `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy`, and a restrictive `Permissions-Policy` on every response. `script-src`/`style-src` retain `'unsafe-inline'`: the former for two small, static inline scripts (theme bootstrap, JSON-LD) and the latter because components render many CSS-custom-property values through inline `style` attributes. Removing either would require a broader refactor (nonce-based script loading; moving inline styles to classes) and is intentionally out of scope for this pass — see the project's known-issues notes.
- All database access is wrapped in `withDatabaseRetry()` (`lib/database-retry.ts`): a bounded number of attempts with a per-attempt timeout, retrying only a known-transient error set, so a database hiccup degrades to a clear, localized `503` instead of an unhandled crash — and error responses are always sanitized (`lib/database-errors.ts`) so a connection string can never leak into a log or response.

## 7. Internationalization

Two static dictionaries — `lib/i18n.ts` (public site) and `lib/admin-i18n.ts` (admin panel) — keyed `ar`/`fr`, including a `decisions` sub-map that translates the fixed decision enum. Locale is a cookie (`moribac_language`), read server-side so `<html lang>`/`dir` are correct on first paint with no client-side flash; the switcher simply flips the cookie and reloads. There are no per-locale routes — both languages are served from the same URL, which is why the site does not declare `hreflang` alternates (see the SEO section of `README.md`).

## 8. Deployment topology

Vercel (Next.js runtime) + Supabase PostgreSQL. `DATABASE_URL` uses Supabase's transaction pooler (for the running app); `DIRECT_URL` uses the session/direct connection (for Prisma migrations and long-running admin operations). The Excel commit route declares a 300-second `maxDuration` and chunks both the upload (for request-size limits) and the candidate insert (for bind-parameter limits) to fit a 50k+ row workbook through a serverless function.
