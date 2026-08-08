# MoriBac

MoriBac is a bilingual Arabic/French platform for importing, reviewing, publishing, and browsing Mauritanian baccalaureate results. It uses Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, ExcelJS, bcrypt, and signed administrator sessions.

Arabic is the default locale. Public visitors do not need accounts; only administrators can access import and publication workflows.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full description of the request flow, data model, Excel import pipeline, and security model.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL 15+ or a Supabase PostgreSQL project
- The official `.xlsx` results file

No PostgreSQL server, Docker, or Podman installation was detected on the audited Windows machine. SQLite is not enabled because maintaining a second Prisma schema would not validate the production PostgreSQL constraints or deployment path. For local development, install PostgreSQL or use a Supabase development project.

## Environment setup

Copy the example file, then replace every placeholder with real values:

```powershell
Copy-Item .env.example .env
npm run env:check
```

Do not commit `.env` or real secrets.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Pooled PostgreSQL URL used by the running application |
| `DIRECT_URL` | Yes | Direct/session PostgreSQL URL used by Prisma migrations |
| `AUTH_SECRET` | Yes | Random administrator-session signing key, at least 32 characters |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical application origin, for example `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Seed only | First administrator email for `npm run db:seed` |
| `SEED_ADMIN_PASSWORD` | Seed only | First administrator password, at least 12 characters |

For Supabase, use the transaction-pooler URL (normally port 6543) for `DATABASE_URL` and the direct or session-pooler URL (normally port 5432) for `DIRECT_URL`. Keep the SSL parameters provided by Supabase. Prisma migrations must not use the transaction-pooler connection.

## Installation and Prisma

```powershell
npm install
npx prisma format
npx prisma validate
npx prisma generate
npm run db:deploy
```

`db:deploy` applies the checked-in migrations, including the `ANNULE` decision required by the official 2025 workbook. Use `npm run db:migrate -- --name descriptive_change` only when developing a new schema migration.

Migrations must not be run until `DATABASE_URL` and `DIRECT_URL` contain valid credentials. The repository deliberately contains no invented database credentials.

### Windows Prisma EPERM repair

On Windows, `prisma generate` cannot replace `query_engine-windows.dll.node` while a running Next.js process has loaded it. Identify the server that owns the application port, stop only that process, and regenerate:

```powershell
netstat -ano | Select-String ':3000'
Stop-Process -Id <NEXT_SERVER_PID>
npx prisma generate
```

During the audit, Next.js PID 22048 was listening on port 3000 and its worker PID 13164 had the Prisma engine loaded. Stopping that project server released the lock and generation succeeded. Do not delete the DLL and do not terminate unrelated Node/IDE processes.

## Create the first administrator

The recommended one-time command is:

```powershell
npm run admin:create -- admin@example.mr "a-strong-unique-password-with-12-or-more-characters"
```

The password is hashed with bcrypt cost 12 before storage. Alternatively, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, run `npm run db:seed` once, and remove those two variables afterward.

There are no hard-coded administrator credentials.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:3000`. The administrator login is at `/admin/login`.

If PostgreSQL is not configured or unavailable, public database APIs return a safe `503 SERVICE_UNAVAILABLE` response and the public interface shows a localized retry state. Server logs include only a Prisma error code, not connection credentials.

## Official BAC2025 workbook

`BAC2025.xlsx` was scanned directly. It contains private birth data and is ignored by Git; do not commit or deploy the workbook itself. See [BAC2025_ANALYSIS.md](BAC2025_ANALYSIS.md) for the complete report.

Summary:

- Sheet: `FICHIER_RESULTATS_BAC_2025_5314`
- Candidate rows: 53,148
- Candidate numbers: 53,148 unique five-character text values
- Duplicate candidate numbers: 0
- Invalid/out-of-range averages: 0
- Decisions: `ADMIS`, `SESSIONNAIRE`, `REDOUBLE`, `ABSENT`, `ANNULE`
- SHA-256: `335511ae00b5907683562a783b34e1247c0d781ab078ab7d27a2d5ddd9dbbb7a`

The importer is schema-independent and future-proof: it never hard-codes a column position, sheet name, or year. It detects the header row within the first 50 rows of every worksheet, normalizes headings by removing accents, whitespace, underscores, and punctuation, then applies a broad English/French/Arabic alias list plus fuzzy (Levenshtein) matching. `BAC2025.xlsx` is one verified format, not a hard-coded schema — the same pipeline auto-recognizes future workbooks whose columns are reordered, renamed, added, removed, or written in a different language or capitalization, and only falls back to the manual **Mapping Wizard** when a required field cannot be identified with enough confidence. See [ARCHITECTURE.md](ARCHITECTURE.md#excel-import-pipeline) for the full pipeline.

## Import workflow

1. Sign in at `/admin/login`.
2. Open **Import Excel**.
3. Select the exam year and an `.xlsx` workbook.
4. Choose **Validate and preview**.
5. If mandatory fields cannot be identified safely, complete the bilingual **Mapping Wizard**. Detected Excel columns appear beside all canonical application fields.
6. Confirm the mapping. It is saved by normalized structure and reused automatically for later workbooks with the same columns.
7. Review totals, validation errors, and the first 20 valid rows.
8. Choose **Import as draft** only when the invalid count is zero.
9. Inspect the imported year under **Manage results**.
10. Publish manually; import never publishes automatically.
11. Set the intended published year as the default.
Only candidate number, full name, series, average, and decision are mandatory. Wilaya, exam center, school, birth date, birth place, and candidate type are optional and become PostgreSQL `NULL` when absent. Validation also checks the extension, MIME type, XLSX ZIP signature, maximum size, missing mandatory values, averages, decisions, duplicate candidate numbers, and checksum. Candidate numbers are never numerically coerced; repeated display whitespace is normalized and averages are rounded to two decimals.

Validation and failed imports are logged in `ImportBatch`/`ImportError`. The commit reparses the same file, verifies its SHA-256 checksum, rejects previously imported files, and inserts candidates in bounded chunks inside a PostgreSQL transaction. Any commit failure rolls back candidate insertion and marks the batch failed.

An unpublished import batch can be removed from **Import history**. The protected delete operation removes only that batch, its candidates, and errors in a transaction. Published years must be hidden before an import batch can be removed.

## Verify a known candidate

After BAC 2025 is imported and published, pick any candidate number that exists in the workbook you imported (for example, from row 3 of your own `BAC2025.xlsx`) and query it:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/public/search?number=<candidate-number>&year=2025'
```

Illustrative response shape (values below are a fictional example, not a real candidate):

```json
{
  "candidateNumber": "00042",
  "fullName": "Example Candidate Name",
  "series": "M",
  "average": 8.47,
  "decision": "SESSIONNAIRE",
  "wilaya": "Trarza",
  "examCenter": "Example Exam Center",
  "school": "Example School"
}
```

The returned `decision` must translate correctly (Arabic: `الدورة التكميلية`; French: `Session complémentaire` for `SESSIONNAIRE`, and similarly for every other decision value). Birth date and birth place must not be present in the public response.

## Security

- bcrypt password hashes with cost 12
- signed eight-hour administrator sessions
- HttpOnly session cookies; `Secure` in production; SameSite policy
- same-origin and CSRF validation on every administrator mutation
- database-backed failed-login throttling
- server-side protected admin layout and API authorization
- administrator existence rechecked for every privileged mutation
- security headers: CSP, frame denial (`X-Frame-Options: DENY`), content-type protection, restricted `Permissions-Policy`, HSTS (`Strict-Transport-Security`), `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy`
- no public birth fields and no Excel parsing during searches

## SEO

- Per-page metadata (title template, description, canonical URL) plus Open Graph and Twitter card tags on every page.
- `WebSite` structured data (JSON-LD, schema.org) describing MoriBac accurately as an independent results platform.
- `app/robots.ts` allows public pages and disallows `/admin/` and every `/api/*` route (JSON endpoints have no indexable content).
- `app/sitemap.ts` lists indexable pages with `lastModified` for freshness signals.
- Arabic is served as the default `<html lang>`/`dir="rtl"` on first paint (no client-side flash), with `og:locale`/`og:locale:alternate` declaring both languages. The site uses one cookie-selected locale per URL rather than per-locale routes, so no `hreflang` alternates are declared — that would require separate `/ar`/`/fr` URLs, a routing change out of scope for this pass (see ARCHITECTURE.md).

## Verification commands

```powershell
npm run env:check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=low
npm run excel:analyze
```

The test suite includes multiple unrelated workbook layouts (including a fully reordered, Arabic-header, future-workbook simulation), automatic header-row detection, normalization, alias/fuzzy matching, manual mapping, saved-mapping reuse, nullable optional fields, the full official workbook parse, leading-zero preservation, duplicate candidates/files, browse priority, pagination, admin protection, translations, and formatting.

## Supabase and Vercel deployment

1. Create the Supabase project and configure the pooled/direct URLs locally.
2. Run `npm run env:check`, then `npm run db:deploy` from a trusted environment.
3. Create the first administrator.
4. Import the repository into Vercel.
5. Add `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, and `NEXT_PUBLIC_APP_URL` as encrypted Production environment variables.
6. Deploy and verify `/`, `/admin/login`, and the public API health.
7. Import `BAC2025.xlsx` as draft, review it, publish it manually, and set 2025 as default.

The Excel commit route declares a 300-second maximum duration because the official file contains more than 53,000 rows. Confirm that the selected Vercel plan supports the required function duration and memory, or run the import from a controlled Node deployment using the same application and PostgreSQL database.