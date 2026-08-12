import { PrismaClient } from "@prisma/client";

/**
 * BAC 2026 SubjectScheme data, recovered from the official Najahi result
 * screenshots supplied by the operator (one per series: SN, M, LM, LA, LO,
 * TM, TS) - not from the earlier Najahi bulk extraction, which never carried
 * subject names/coefficients/order for BAC (see docs/subject-grades-architecture.md
 * and the recovery report in conversation history).
 *
 * nameAr is read directly off each screenshot for every code. nameFr is filled
 * only where an independent authoritative source exists (the BEPC subject
 * dictionary embedded in Najahi's own client bundle, which happens to share
 * these 10 codes: AN, AR, EP, FR, HG, IR, MT, PC, SN, ES). The remaining 11
 * codes (PH, DM, PI, CH, CM, AF, AT, TA, DS, EL, ME) have no confirmed French
 * source - left null on purpose, never guessed/translated. displayOrder is
 * the exact top-to-bottom order shown on each screenshot, independently
 * cross-checked against the fixed subject order already found in all 64,532
 * raw candidate records (100% positional match everywhere both were
 * verifiable).
 *
 * Requires the pending SubjectScheme migration to be applied first
 * (20260730161313_add_subject_grades onward) - this script does not run
 * migrations.
 */

const EXAM_YEAR = 2026;
const EXAM_TYPE = "bac";

type SubjectRow = { code: string; nameAr: string; nameFr: string | null; coefficient: number };

const SCHEMES: Record<string, SubjectRow[]> = {
  SN: [
    { code: "SN", nameAr: "العلوم الطبيعية", nameFr: "Sciences naturelles", coefficient: 8 },
    { code: "PC", nameAr: "الفيزياء والكيمياء", nameFr: "Physique-chimie", coefficient: 7 },
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 6 },
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 3 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 3 },
    { code: "AN", nameAr: "الإنجليزية", nameFr: "Anglais", coefficient: 2 },
    { code: "IR", nameAr: "التربية الإسلامية", nameFr: "Instruction religieuse", coefficient: 2 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 }
  ],
  M: [
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 9 },
    { code: "PC", nameAr: "الفيزياء والكيمياء", nameFr: "Physique-chimie", coefficient: 8 },
    { code: "SN", nameAr: "العلوم الطبيعية", nameFr: "Sciences naturelles", coefficient: 4 },
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 3 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 3 },
    { code: "AN", nameAr: "الإنجليزية", nameFr: "Anglais", coefficient: 2 },
    { code: "IR", nameAr: "التربية الإسلامية", nameFr: "Instruction religieuse", coefficient: 2 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 }
  ],
  LM: [
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 6 },
    { code: "PH", nameAr: "الفلسفة", nameFr: null, coefficient: 6 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 6 },
    { code: "HG", nameAr: "التاريخ والجغرافيا", nameFr: "Histoire-géographie", coefficient: 5 },
    { code: "AN", nameAr: "الإنجليزية", nameFr: "Anglais", coefficient: 4 },
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 2 },
    { code: "IR", nameAr: "التربية الإسلامية", nameFr: "Instruction religieuse", coefficient: 2 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 }
  ],
  LA: [
    { code: "ES", nameAr: "الإسبانية", nameFr: "Espagnol", coefficient: 8 },
    { code: "AN", nameAr: "الإنجليزية", nameFr: "Anglais", coefficient: 6 },
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 4 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 4 },
    { code: "PH", nameAr: "الفلسفة", nameFr: null, coefficient: 3 },
    { code: "IR", nameAr: "التربية الإسلامية", nameFr: "Instruction religieuse", coefficient: 2 },
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 2 },
    { code: "HG", nameAr: "التاريخ والجغرافيا", nameFr: "Histoire-géographie", coefficient: 2 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 }
  ],
  LO: [
    { code: "DM", nameAr: "التشريع الإسلامي", nameFr: null, coefficient: 7 },
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 7 },
    { code: "PI", nameAr: "الفكر الإسلامي", nameFr: null, coefficient: 6 },
    { code: "HG", nameAr: "التاريخ والجغرافيا", nameFr: "Histoire-géographie", coefficient: 4 },
    { code: "CH", nameAr: "القرآن والحديث", nameFr: null, coefficient: 3 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 2 },
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 2 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 }
  ],
  TM: [
    { code: "CM", nameAr: "الإنشاءات الميكانكية", nameFr: null, coefficient: 7 },
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 6 },
    { code: "PC", nameAr: "الفيزياء والكيمياء", nameFr: "Physique-chimie", coefficient: 4 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 3 },
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 2 },
    { code: "AF", nameAr: "التحليل الصناعي", nameFr: null, coefficient: 2 },
    { code: "AT", nameAr: "الورشة", nameFr: null, coefficient: 2 },
    { code: "TA", nameAr: "التكنولوجيا والآلية", nameFr: null, coefficient: 2 },
    { code: "IR", nameAr: "التربية الإسلامية", nameFr: "Instruction religieuse", coefficient: 2 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 },
    { code: "AN", nameAr: "الإنجليزية", nameFr: "Anglais", coefficient: 1 }
  ],
  TS: [
    { code: "DS", nameAr: "الرسم الصناعي", nameFr: null, coefficient: 7 },
    { code: "EL", nameAr: "الإلكترونيات", nameFr: null, coefficient: 6 },
    { code: "MT", nameAr: "الرياضيات", nameFr: "Mathématiques", coefficient: 4 },
    { code: "PC", nameAr: "الفيزياء والكيمياء", nameFr: "Physique-chimie", coefficient: 3 },
    { code: "AT", nameAr: "الورشة", nameFr: null, coefficient: 3 },
    { code: "AR", nameAr: "العربية", nameFr: "Arabe", coefficient: 2 },
    { code: "FR", nameAr: "الفرنسية", nameFr: "Français", coefficient: 2 },
    { code: "IR", nameAr: "التربية الإسلامية", nameFr: "Instruction religieuse", coefficient: 2 },
    { code: "AN", nameAr: "الإنجليزية", nameFr: "Anglais", coefficient: 1 },
    { code: "ME", nameAr: "القياس والاختبارات", nameFr: null, coefficient: 1 },
    { code: "EP", nameAr: "الرياضة البدنية", nameFr: "Éducation physique", coefficient: 1 }
  ]
};

async function main() {
  const db = new PrismaClient();
  try {
    const examYear = await db.examYear.upsert({
      where: { year_session: { year: EXAM_YEAR, session: "NORMAL" } },
      create: { year: EXAM_YEAR },
      update: {}
    });

    let count = 0;
    for (const [series, subjects] of Object.entries(SCHEMES)) {
      for (const [index, subject] of subjects.entries()) {
        await db.subjectScheme.upsert({
          where: {
            examYearId_examType_series_subjectCode: {
              examYearId: examYear.id,
              examType: EXAM_TYPE,
              series,
              subjectCode: subject.code
            }
          },
          create: {
            examYearId: examYear.id,
            examType: EXAM_TYPE,
            series,
            subjectCode: subject.code,
            nameAr: subject.nameAr,
            nameFr: subject.nameFr,
            coefficient: subject.coefficient,
            displayOrder: index + 1
          },
          update: {
            nameAr: subject.nameAr,
            nameFr: subject.nameFr,
            coefficient: subject.coefficient,
            displayOrder: index + 1
          }
        });
        count += 1;
      }
    }
    console.log(`Seeded ${count} SubjectScheme rows for BAC ${EXAM_YEAR}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "SubjectScheme seed failed.");
  process.exitCode = 1;
});
