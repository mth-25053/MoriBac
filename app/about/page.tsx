import type { Metadata } from "next";
import { Accessibility, EyeOff } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";

export const metadata:Metadata={
  title:"À propos",
  description:"MoriBac facilite l’accès aux résultats du baccalauréat mauritanien tout en protégeant les données personnelles des candidats.",
  alternates:{canonical:"/about"}
};
export default async function AboutPage(){const{dict,locale}=await getDictionary();return <><SiteHeader dict={dict} locale={locale}/><main className="shell py-16 sm:py-24"><span className="eyebrow">{dict.about}</span><h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{dict.aboutTitle}</h1><p className="muted mt-6 max-w-3xl text-lg leading-8">{dict.aboutText}</p><div className="mt-14 grid gap-5 md:grid-cols-2"><article className="surface p-8 transition-transform hover:-translate-y-0.5"><span className="grid size-12 place-items-center rounded-xl" style={{background:"var(--accent-soft)"}}><EyeOff className="text-[var(--accent)]"/></span><h2 className="mt-5 text-xl font-black">{dict.privacyTitle}</h2><p className="muted mt-3 leading-7">{dict.privacyText}</p></article><article className="surface p-8 transition-transform hover:-translate-y-0.5"><span className="grid size-12 place-items-center rounded-xl" style={{background:"var(--accent-soft)"}}><Accessibility className="text-[var(--accent)]"/></span><h2 className="mt-5 text-xl font-black">{dict.accessibilityTitle}</h2><p className="muted mt-3 leading-7">{dict.accessibilityText}</p></article></div></main><SiteFooter dict={dict}/></>}

