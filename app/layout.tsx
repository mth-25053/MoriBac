import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { LANGUAGE_COOKIE, THEME_COOKIE } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "MoriBac — Résultats du Baccalauréat", template: "%s — MoriBac" },
  description: "Plateforme bilingue de consultation des résultats du baccalauréat mauritanien.",
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "ar_MR", alternateLocale: "fr_MR", title: "MoriBac", description: "Résultats du baccalauréat mauritanien" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f7f6" }, { media: "(prefers-color-scheme: dark)", color: "#101613" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale = jar.get(LANGUAGE_COOKIE)?.value === "fr" ? "fr" : "ar";
  const theme = jar.get(THEME_COOKIE)?.value;
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(()=>{try{const t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}})()` }} /></head>
      <body>{children}<Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} richColors /></body>
    </html>
  );
}
