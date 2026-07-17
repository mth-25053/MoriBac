import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return <footer className="mt-20 border-t py-9" style={{borderColor:"var(--line)"}}><div className="shell flex flex-col justify-between gap-4 text-sm md:flex-row"><p className="muted">© {new Date().getFullYear()} {dict.brand}. {dict.footer}</p><div className="flex gap-5"><Link href="/about">{dict.about}</Link><Link href="/admin/login">{dict.admin}</Link></div></div></footer>;
}
