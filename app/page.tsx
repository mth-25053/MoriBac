import { HomeExperience } from "@/components/home-experience";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";

export default async function HomePage() { const {dict,locale}=await getDictionary(); return <><SiteHeader dict={dict} locale={locale}/><main><HomeExperience dict={dict} locale={locale}/></main><SiteFooter dict={dict}/></>; }
