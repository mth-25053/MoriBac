# BAC2025.xlsx Analysis

Analysis date: 2026-07-15  
Source file: `BAC2025.xlsx`  
File size: 4,507,731 bytes  
SHA-256: `335511ae00b5907683562a783b34e1247c0d781ab078ab7d27a2d5ddd9dbbb7a`

The analysis was performed directly with ExcelJS over every row of the supplied workbook. No mock data was used.

## Workbook structure

- Sheet count: **1**
- Sheet name: `FICHIER_RESULTATS_BAC_2025_5314`
- Worksheet rows: **53,149** including the header
- Candidate rows: **53,148**
- Columns: **11**
- Header row: row 1

Exact columns, in order:

1. `NUMBAC`
2. `SERIE`
3. `TYPECANDIDAT`
4. `NOM`
5. `DATE_NAISSANCE`
6. `LIEU_NAISSANCE`
7. `MoyBac`
8. `Decision`
9. `Wilaya`
10. `CentreExamen`
11. `Etablissement`

## Cell types

| Column | ExcelJS type | Count | Notes |
|---|---:|---:|---|
| `NUMBAC` | String | 53,148 | All candidate numbers are already text |
| `SERIE` | String | 53,148 | No missing values |
| `TYPECANDIDAT` | String | 53,148 | No missing values |
| `NOM` | String | 53,148 | No missing values |
| `DATE_NAISSANCE` | Date | 53,148 | Excel dates are loaded as JavaScript dates |
| `LIEU_NAISSANCE` | String | 53,138 | 10 null cells |
| `MoyBac` | Number | 53,148 | Numeric values, frequently with more than two decimals |
| `Decision` | String | 53,148 | Contains five distinct statuses |
| `Wilaya` | String | 53,148 | No missing values |
| `CentreExamen` | String | 53,148 | No missing values |
| `Etablissement` | String | 53,148 | No missing values |

`LIEU_NAISSANCE` is the only column with missing values, and it is optional/private in the application. All eight public-result fields required by the importer are present on every row.

## Candidate numbers and leading zeros

- Unique `NUMBAC` values: **53,148**
- Duplicate candidate numbers: **0**
- Malformed/non-digit candidate numbers: **0**
- Numeric candidate-number cells: **0**
- Candidate-number length: exactly **5 characters** for every row
- Candidate numbers beginning with zero: **9,971**

Leading zeros are preserved in the official file because every `NUMBAC` cell is stored as Excel text. The importer must map `NUMBAC` directly to a database `TEXT` value and must never call `Number`, `parseInt`, or numeric coercion on it.

A five-character candidate number with a leading zero is present at worksheet row 3 (fictional example values, not a real candidate, used only to illustrate the leading-zero and field-shape checks below):

| Field | Value |
|---|---|
| Candidate number | `00002` |
| Full name | `Example Candidate Name` |
| Series | `M` |
| Average | `8.47177419354839` (display/import value: `8.47`) |
| Decision | `SESSIONNAIRE` |
| Wilaya | `Trarza` |
| Exam center | `Lycée  Example Center` |
| School | `Example School  Candidat  Libre` |

## Decision values

| Decision | Rows |
|---|---:|
| `ADMIS` | 10,002 |
| `SESSIONNAIRE` | 7,059 |
| `REDOUBLE` | 32,423 |
| `ABSENT` | 3,329 |
| `ANNULE` | 335 |

`ANNULE` is a real official status that was not represented in the original Prisma enum or translation dictionaries. Without adding it, the existing importer rejects 335 rows and therefore rejects the entire workbook.

Recommended translations:

- Arabic: `ملغى`
- French: `Annulé`

## Series values

| Series | Rows |
|---|---:|
| `SN` | 31,497 |
| `LO` | 12,000 |
| `LM` | 7,698 |
| `M` | 1,550 |
| `TM` | 304 |
| `TS` | 87 |
| `LA` | 12 |

## Candidate types

`TYPECANDIDAT` is not required for the public result card, but the official values are:

| Type | Rows |
|---|---:|
| `CP` | 23,575 |
| `OF` | 15,961 |
| `CL` | 13,597 |
| `CM` | 15 |

The current database does not store this field. It can be safely ignored for the current product requirements, or added later if administrators need candidate-type reporting.

## Averages

- Malformed/non-numeric averages: **0**
- Averages outside 0–20: **0**
- Minimum: **0**
- Maximum: **17.94921875**
- Zero averages: **1,952**

The database uses `DECIMAL(5,2)`, so values must be rounded to two decimals during import. Public output must display exactly two decimals followed by `/20`.

## Filters and text quality

- Raw unique wilayas: **15**
- Raw unique exam centers: **161**
- Raw unique schools: **550**
- Whitespace-normalized unique wilayas: **15**
- Whitespace-normalized unique exam centers: **161**
- Whitespace-normalized unique schools: **550**
- Values containing repeated whitespace: **34,822**

Repeated spaces are common, for example `Lycée  Rosso` and `Rosso Candidat  Libre`. Collapsing repeated whitespace does not change the number of unique wilayas, centers, or schools, so normalization is safe and will produce cleaner display/filter values.

No Unicode replacement characters or common UTF-8 mojibake sequences were found in the workbook. Accented text such as `Lycée` loads correctly.

## Sample valid records

The rows below are fictional examples (invented names and centers, real column shapes/value ranges) illustrating the record shape found throughout the workbook — they are not real candidates.

| NUMBAC | NOM | SERIE | MoyBac | Decision | Wilaya | CentreExamen | Etablissement |
|---|---|---|---:|---|---|---|---|
| `00001` | Example Candidate One | SN | 6.79032258064516 | REDOUBLE | Nouakchott Nord | Example Center 4 | Example School Candidat Libre |
| `00002` | Example Candidate Two | M | 8.47177419354839 | SESSIONNAIRE | Trarza | Example Lycée | Example School Candidat Libre |
| `00003` | Example Candidate Three | LO | 5.79427083333333 | REDOUBLE | Nouakchott Nord | Example School 3 | Example School Candidat Libre |
| `00004` | Example Candidate Four | SN | 6.8252688172043 | REDOUBLE | Nouakchott Sud | Example Lycée 1 | Example School Candidat Libre |
| `00005` | Example Candidate Five | SN | 8.72395833333333 | SESSIONNAIRE | Trarza | Example School 1 | Example School Candidat Libre |

## Existing importer compatibility

Before repair, the importer is **not compatible** with this workbook:

- `NUMBAC` is not recognized as candidate number.
- `NOM` is not recognized as full name.
- `MoyBac` is not recognized as average.
- `CentreExamen` is not recognized as exam center.
- `ANNULE` is not recognized as a decision.

The importer must add these official aliases, add the `ANNULE` status throughout Prisma/API/UI/translations, read Excel date cells safely, retain optional missing birth places, and normalize repeated whitespace in display/filter fields. After those changes, the complete workbook should validate as 53,148 valid rows with zero duplicate numbers and zero invalid averages.
