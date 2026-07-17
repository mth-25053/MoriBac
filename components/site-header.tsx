import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteHeader({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return <header className="border-b" style={{borderColor:"var(--line)",background:"color-mix(in srgb,var(--bg) 88%,transparent)"}}>
    <div className="shell flex min-h-18 items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2 text-lg font-black" aria-label={dict.home}><span className="grid size-10 place-items-center rounded-xl text-white" style={{background:"var(--accent)"}}><GraduationCap size={22}/></span>{dict.brand}</Link>
      <nav className="hidden items-center gap-6 md:flex" aria-label={dict.home}><Link href="/" className="font-bold hover:underline">{dict.home}</Link><Link href="/about" className="font-bold hover:underline">{dict.about}</Link></nav>
      <div className="flex items-center gap-2"><LanguageSwitcher locale={locale} label={dict.language}/><ThemeSwitcher label={dict.theme}/></div>
    </div>
  </header>;
}
