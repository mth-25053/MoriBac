import { db } from "@/lib/db";
import { adminDictionary } from "@/lib/admin-i18n";
import { getLocale } from "@/lib/i18n";
export default async function Dashboard(){const dict=adminDictionary(await getLocale());const[years,candidates,imports]=await Promise.all([db.examYear.count(),db.candidate.count(),db.importBatch.count()]);return <div><span className="eyebrow">{dict.dashboard}</span><h1 className="mt-2 text-3xl font-black">{dict.welcome}</h1><div className="mt-8 grid gap-4 sm:grid-cols-3">{[[dict.years,years],[dict.candidates,candidates],[dict.imports,imports]].map(([label,value])=><div className="surface p-6" key={label}><div className="text-4xl font-black tabular-nums text-[var(--accent)]">{value}</div><div className="muted mt-2 font-bold">{label}</div></div>)}</div></div>}
