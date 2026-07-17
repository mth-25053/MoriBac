# Build a Production-Ready Mauritanian Baccalaureate Results Platform

## Objective

Build a complete, production-ready web application for publishing Mauritanian Baccalaureate examination results.

This is NOT a prototype.

The application must be scalable, maintainable, secure, responsive, and visually polished.

The design must look like it was handcrafted by a professional product designer—not AI-generated.

Do NOT copy the UI, branding, logo, colors, or layout of any existing website.

Create an original visual identity.

---

# General Requirements

The website must support:

- Arabic (default language)
- French
- Light Mode
- Dark Mode
- Mobile-first responsive design
- Accessibility
- High performance
- Clean architecture
- SEO friendly

---

# Technology Stack

Use:

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Zod
- SheetJS (or equivalent Excel parser)
- NextAuth (or secure authentication solution)

Deployment target:

- Vercel
- Supabase PostgreSQL

---

# Design Requirements

Design a modern interface.

Requirements:

- Elegant
- Minimal
- Professional
- Fast
- Clean spacing
- Soft colors
- Rounded corners
- Beautiful typography
- Excellent mobile experience

Avoid:

- Generic templates
- AI-looking cards
- Overly colorful gradients
- Heavy animations
- Visual clutter

The UI should feel like a premium SaaS product.

---

# Languages

Support:

Arabic
French

Arabic is the default language.

Requirements:

- RTL for Arabic
- LTR for French
- Language switcher
- Remember selected language
- Translate every text
- Translate validation messages
- Translate admin panel
- Translate result statuses

---

# Theme

Support:

- Light Mode
- Dark Mode

Requirements:

- Detect system preference
- Allow manual switching
- Save user preference
- Beautiful colors in both modes

---

# Homepage

The homepage contains two main sections.

---

## Section 1

Candidate Search

Search using:

Candidate Number

Search must be instant.

Do not reload the page.

Show loading state.

Show validation errors.

Show "Result not found" if necessary.

---

## Candidate Result Card

Display:

- Candidate Number
- Full Name
- Series
- Average
- Decision
- Wilaya
- Exam Center
- School

Hide:

- Birth Date
- Birth Place

Average:

Display with two decimal places.

Example:

13.47 /20

Translate decision automatically.

Example:

ADMIS

Arabic:
ناجح

French:
Admis

SESSIONNAIRE

Arabic:
الدورة التكميلية

French:
Session complémentaire

REDOUBLE

Arabic:
راسب

French:
Non admis

ABSENT

Arabic:
غائب

French:
Absent

---

# Section 2

Browse Results

The user MUST first select a Series.

No results are shown before selecting a Series.

After selecting a Series:

Display the Top 10 candidates in that series.

Ordered by average descending.

---

# Filters

Available filters:

- Series (required)
- Wilaya
- Exam Center
- School

Filters are dependent.

Example:

Select Wilaya

↓

Only show centers inside that Wilaya.

Select Center

↓

Only show schools inside that Center.

---

# IMPORTANT BROWSING LOGIC

Implement this exact behavior.

IF no Series selected

Show nothing.

Ask the user to choose a Series.

---

IF only Series selected

Show Top 10 of that Series.

---

IF Series selected
AND Center selected

Ignore the selected Series.

Display ALL candidates inside that Center.

Every series.

---

IF Series selected
AND School selected

Ignore the selected Series.

Display ALL candidates inside that School.

Every series.

Priority:

School

↓

Center

↓

Top 10

This logic is mandatory.

---

# Lists

Center list

Display:

- Rank
- Name
- Average
- Series
- Decision
- School
- Wilaya

Pagination:

50 candidates per page.

Server-side pagination only.

Sorting:

- Highest Average
- Lowest Average
- Name
- Candidate Number

---

# Statistics

For Center or School pages display:

- Total Candidates
- Total Passed
- Session Candidates
- Failed Candidates
- Highest Average
- Success Rate

Calculate on the server.

---

# Admin Panel

Create:

/admin/login

Admin authentication.

Visitors do not need accounts.

Only administrators can login.

Use:

Email

Password

After login:

Dashboard

---

Admin Features

- Upload Excel
- Preview Excel
- Validate Excel
- Import Results
- Publish Results
- Hide Results
- Delete Exam Year
- Import History
- Logout

---

# Excel Import

The project will receive official Excel files every year.

Example:

BAC2025.xlsx

Workflow:

Upload

↓

Validate

↓

Preview

↓

Import

↓

Publish

Never publish automatically.

Import as Draft first.

---

Validation

Validate:

Columns

Duplicate candidate numbers

Missing values

Invalid averages

Invalid rows

Preview first 20 rows.

Display report before importing.

---

Database Rules

Candidate Number MUST be stored as TEXT.

Never convert

00001

to

1

Keep leading zeros forever.

Use database transactions.

Rollback if import fails.

Prevent duplicate imports.

Generate SHA256 checksum.

Keep import logs.

---

# Multi-Year Support

Support multiple years.

Example:

BAC 2025

BAC 2026

Allow:

Publish

Hide

Delete

Default year

---

# Database

Create models such as:

Admin

ExamYear

Candidate

ImportBatch

ImportErrors

Settings

Use indexes on:

Candidate Number

Series

Center

School

Wilaya

Average

Year

---

# Security

Secure authentication.

Password hashing:

Argon2

or

bcrypt.

HttpOnly cookies.

Secure cookies.

CSRF protection.

Rate limiting.

Protect every admin API.

Never trust client-side authorization.

---

# Performance

The website will likely receive fewer than 1,000 users.

Still optimize:

Database indexes

Lazy loading

Image optimization

Server pagination

Caching

Fast API responses

No Excel parsing during searches.

Import once.

Search database only.

---

# Accessibility

Keyboard navigation

Screen reader support

Focus states

Color contrast

Semantic HTML

Accessible forms

---

# Mobile Experience

Mobile first.

Large touch targets.

Readable typography.

No horizontal scrolling.

Cards on mobile.

Tables on desktop.

---

# Required Pages

/

About

Admin Login

Admin Dashboard

Import Excel

Manage Results

Import History

Settings

404

500

---

# Components

Header

Footer

Theme Switcher

Language Switcher

Candidate Search

Result Card

Series Selector

Wilaya Selector

Center Selector

School Selector

Top Ten List

Results Table

Pagination

Statistics Cards

Excel Upload

Import Preview

Import Report

Loading State

Error State

Empty State

Toast Notifications

---

# Documentation

Generate:

README.md

.env.example

Explain:

Installation

Database

Prisma

Running locally

Creating admin

Importing Excel

Deploying to Vercel

Supabase configuration

Environment variables

---

# Final Requirement

You are responsible for making architectural decisions.

Do not ask unnecessary questions.

Only ask if essential information is missing.

Run the project.

Fix TypeScript errors.

Fix ESLint errors.

Test every feature.

Ensure production quality.

The final result must be a real application ready for deployment, not a demo.