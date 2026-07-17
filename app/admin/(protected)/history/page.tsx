import { HistoryTable } from "@/components/admin/history-table";
import { adminDictionary } from "@/lib/admin-i18n";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function HistoryPage() {
  const dict = adminDictionary(await getLocale());
  const imports = await db.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { examYear: { select: { year: true, isPublished: true } }, admin: { select: { email: true } } }
  });
  const rows = imports.map((batch) => ({
    id: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    validRows: batch.validRows,
    invalidRows: batch.invalidRows,
    totalRows: batch.totalRows,
    createdAt: batch.createdAt.toISOString(),
    checksum: batch.checksum,
    adminEmail: batch.admin.email,
    year: batch.examYear.year,
    isPublished: batch.examYear.isPublished
  }));
  return <div><span className="eyebrow">{dict.history}</span><h1 className="mt-2 text-3xl font-black">{dict.history}</h1><div className="surface mt-7 overflow-hidden"><HistoryTable rows={rows} dict={dict}/></div></div>;
}