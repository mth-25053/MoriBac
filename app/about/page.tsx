import type { Metadata } from "next";
import { Accessibility, EyeOff } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";

export const metadata:Metadata={title:"À propos"};
export default async function AboutPage(){const{dict,locale}=await getDictionary();return <><SiteHeader dict={dict} locale={locale}/><main className="shell py-16"><span className="eyebrow">{dict.about}</span><h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{dict.aboutTitle}</h1><p className="muted mt-6 max-w-3xl text-lg leading-8">{dict.aboutText}</p><div className="mt-12 grid gap-5 md:grid-cols-2"><article className="surface p-7"><EyeOff className="text-[var(--accent)]"/><h2 className="mt-5 text-xl font-black">{dict.privacyTitle}</h2><p className="muted mt-3 leading-7">{dict.privacyText}</p></article><article className="surface p-7"><Accessibility className="text-[var(--accent)]"/><h2 className="mt-5 text-xl font-black">{dict.accessibilityTitle}</h2><p className="muted mt-3 leading-7">{dict.accessibilityText}</p></article></div></main><SiteFooter dict={dict}/></>}

