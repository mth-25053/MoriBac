import { SubjectSchemeDiscovery } from "@/components/admin/subject-scheme-discovery";
import { SubjectSchemeManager } from "@/components/admin/subject-scheme-manager";
import { adminDictionary } from "@/lib/admin-i18n";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function SubjectSchemesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const dict = adminDictionary(await getLocale());
  const years = await db.examYear.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true, isDefault: true } });
  const { year: yearParam } = await searchParams;
  const requestedYear = yearParam ? Number(yearParam) : undefined;
  const selectedYear = years.find((year) => year.year === requestedYear) ?? years.find((year) => year.isDefault) ?? years[0] ?? null;

  const schemes = selectedYear
    ? await db.subjectScheme.findMany({
        where: { examYearId: selectedYear.id, examType: "bac" },
        orderBy: [{ series: "asc" }, { displayOrder: "asc" }]
      })
    : [];

  return <div>
    <span className="eyebrow">{dict.subjectSchemesNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.subjectSchemesNav}</h1>
    <div className="mt-7">
      <SubjectSchemeDiscovery dict={dict} />
    </div>
    <SubjectSchemeManager
      dict={dict}
      years={years.map((year) => ({ id: year.id, year: year.year, isDefault: year.isDefault }))}
      selectedYearId={selectedYear?.id ?? null}
      schemes={schemes.map((scheme) => ({
        id: scheme.id,
        series: scheme.series,
        subjectCode: scheme.subjectCode,
        nameAr: scheme.nameAr,
        nameFr: scheme.nameFr,
        coefficient: scheme.coefficient === null ? null : Number(scheme.coefficient),
        displayOrder: scheme.displayOrder
      }))}
    />
  </div>;
}
