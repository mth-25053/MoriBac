import { GradeImportClient } from "@/components/admin/grade-import-client";
import { adminDictionary } from "@/lib/admin-i18n";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function GradeImportPage() {
  const locale = await getLocale();
  const dict = adminDictionary(locale);
  const batches = await db.gradeImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { examYear: { select: { year: true } }, admin: { select: { email: true } } }
  });

  return <GradeImportClient
    dict={dict}
    locale={locale}
    history={batches.map((batch) => ({
      id: batch.id,
      fileName: batch.sourceFileName,
      status: batch.status,
      totalRows: batch.totalRows,
      validatedRows: batch.validatedRows,
      importedRows: batch.importedRows,
      rejectedRows: batch.rejectedRows,
      createdAt: batch.createdAt.toISOString(),
      year: batch.examYear.year,
      adminEmail: batch.admin.email
    }))}
  />;
}
