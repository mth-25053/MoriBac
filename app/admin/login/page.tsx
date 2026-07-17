import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { adminDictionary } from "@/lib/admin-i18n";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
export const metadata={title:"Administration",robots:{index:false,follow:false}};
export default async function LoginPage(){if(await readSession())redirect("/admin");const dict=adminDictionary(await getLocale());return <main className="grid min-h-screen place-items-center p-4"><LoginForm dict={dict}/></main>}
