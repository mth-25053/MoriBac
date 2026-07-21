import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return <footer className="mt-24 border-t py-10" style={{ borderColor: "var(--line)" }}>
    <div className="shell flex flex-col justify-between gap-4 text-sm md:flex-row md:items-center">
      <p className="muted">© {new Date().getFullYear()} {dict.brand}. {dict.footer}</p>
      <div className="flex gap-6 font-bold">
        <Link href="/about" className="transition-colors hover:text-[var(--accent)]">{dict.about}</Link>
        <Link href="/admin/login" className="muted transition-colors hover:text-[var(--accent)]">{dict.admin}</Link>
      </div>
    </div>
  </footer>;
}
