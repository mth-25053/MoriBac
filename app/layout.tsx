import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Manrope, Noto_Kufi_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { LANGUAGE_COOKIE, THEME_COOKIE } from "@/lib/constants";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const notoKufiArabic = Noto_Kufi_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap", weight: ["400", "500", "700", "800"] });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const description = "Plateforme bilingue de consultation des résultats du baccalauréat mauritanien : recherchez votre résultat par numéro de candidat, instantanément et en toute confidentialité.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "MoriBac — Résultats du Baccalauréat", template: "%s — MoriBac" },
  description,
  keywords: ["MoriBac", "baccalauréat mauritanien", "résultats BAC Mauritanie", "بكالوريا موريتانيا", "نتائج البكالوريا", "BAC Mauritanie"],
  applicationName: "MoriBac",
  category: "education",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "MoriBac",
    locale: "ar_MR",
    alternateLocale: "fr_MR",
    title: "MoriBac — Résultats du Baccalauréat",
    description
  },
  twitter: {
    card: "summary",
    title: "MoriBac — Résultats du Baccalauréat",
    description
  }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f7f6" }, { media: "(prefers-color-scheme: dark)", color: "#101613" }] };

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MoriBac",
  url: siteUrl,
  description,
  inLanguage: ["ar", "fr"],
  publisher: { "@type": "Organization", name: "MoriBac" }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale = jar.get(LANGUAGE_COOKIE)?.value === "fr" ? "fr" : "ar";
  const theme = jar.get(THEME_COOKIE)?.value;
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${manrope.variable} ${notoKufiArabic.variable}${theme === "dark" ? " dark" : ""}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(()=>{try{const t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}})()` }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body>{children}<Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} richColors /></body>
    </html>
  );
}
