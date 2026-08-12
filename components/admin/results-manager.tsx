"use client";
import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";

type Year = { id: string; year: number; session: "NORMAL" | "COMPLEMENTAIRE"; labelAr: string | null; labelFr: string | null; isPublished: boolean; isDefault: boolean; _count: { candidates: number; imports: number } };

export function ResultsManager({ years, dict }: { years: Year[]; dict: AdminDictionary }) {
  const router = useRouter();

  async function mutate(id: string, body: Record<string, unknown>, method = "PATCH") {
    if (body.action === "delete" && !confirm(dict.confirmDelete)) return;
    const response = await fetch(`/api/admin/years/${id}`, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrfFromDocument() },
      body: method === "PATCH" ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) toast.error(data.error === "EMPTY_YEAR" ? dict.emptyYear : dict.serviceUnavailable);
    else { toast.success(dict.saved); router.refresh(); }
  }

  function saveLabel(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutate(id, { action: "label", labelAr: String(form.get("labelAr") || "").trim() || null, labelFr: String(form.get("labelFr") || "").trim() || null });
  }

  return <div>
    <span className="eyebrow">{dict.manage}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.years}</h1>
    <div className="mt-7 space-y-4">
      {years.map((y) => <article className="surface p-5" key={y.id}>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black">BAC {y.year}</h2>
              <span className="badge">{y.session}</span>
              <span className={`badge ${!y.isPublished ? "fail" : ""}`}>{y.isPublished ? dict.published : dict.draft}</span>
              {y.isDefault && <span className="badge">{dict.default}</span>}
            </div>
            <p className="muted mt-2 text-sm">{y._count.candidates} {dict.candidates} · {y._count.imports} {dict.imports}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button secondary" onClick={() => mutate(y.id, { action: y.isPublished ? "hide" : "publish" })}>{y.isPublished ? dict.hide : dict.publish}</button>
            {!y.isDefault && <button className="button secondary" onClick={() => mutate(y.id, { action: "default" })}>{dict.makeDefault}</button>}
            <button className="button secondary !text-[var(--danger)]" onClick={() => mutate(y.id, { action: "delete" }, "DELETE")}>{dict.delete}</button>
          </div>
        </div>
        <form className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" style={{ borderColor: "var(--line)" }} onSubmit={(event) => saveLabel(y.id, event)}>
          <label><span className="label">{dict.editionLabelAr}</span><input name="labelAr" className="field" dir="rtl" defaultValue={y.labelAr ?? ""} placeholder={`BAC ${y.year}`} /></label>
          <label><span className="label">{dict.editionLabelFr}</span><input name="labelFr" className="field" dir="ltr" defaultValue={y.labelFr ?? ""} placeholder={`BAC ${y.year}`} /></label>
          <button type="submit" className="button secondary">{dict.saveLabel}</button>
          <p className="muted text-xs sm:col-span-3">{dict.editionLabelHint}</p>
        </form>
      </article>)}
    </div>
  </div>;
}
