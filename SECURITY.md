# Security Policy

MoriBac (Mth_Bac) publishes Mauritanian BAC exam results. Please report security issues responsibly.

## Reporting a vulnerability

Email **25053@supnum.mr** with a description of the issue, the steps to reproduce it, and its potential impact. Please do not open a public GitHub issue for security reports.

Do **not** include in your report, and do not attempt to demonstrate a finding using:

- real database credentials, API keys, or session tokens
- bulk candidate data, database backups, or exports
- any real candidate's personal data beyond what is already visible through the public search feature

We aim to acknowledge reports within a few days and will let you know once a fix is deployed.

## Scope

In scope: the Next.js application, its public and administrator API routes, authentication/session handling, and the Excel/JSON import pipeline in this repository.

Out of scope: the underlying Supabase/Vercel platforms themselves, and denial-of-service testing against the production deployment.

## Supported versions

This project runs a single production deployment tracking the `main` branch. Only the latest deployed version is supported; there are no maintained older releases.
