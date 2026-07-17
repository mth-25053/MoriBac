import { ImportClient } from "@/components/admin/import-client";
import { adminDictionary } from "@/lib/admin-i18n";
import { getLocale } from "@/lib/i18n";

export default async function ImportPage() {
  const locale = await getLocale();
  return <ImportClient dict={adminDictionary(locale)} locale={locale} />;
}