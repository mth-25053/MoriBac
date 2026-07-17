import { AdminShell } from "@/components/admin/admin-shell";
import { adminDictionary } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function ProtectedLayout({children}:{children:React.ReactNode}){await requireAdmin();const dict=adminDictionary(await getLocale());return <AdminShell dict={dict}>{children}</AdminShell>}
