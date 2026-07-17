"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminDictionary } from "@/lib/admin-i18n";
import { csrfFromDocument } from "@/lib/csrf-client";

type HistoryRow = {
  id: string; fileName: string; status: "VALIDATED" | "IMPORTED" | "FAILED";
  validRows: number; invalidRows: number; totalRows: number; createdAt: string;
  checksum: string; adminEmail: string; year: number; isPublished: boolean;
};

export function HistoryTable({ rows, dict }: { rows: HistoryRow[]; dict: AdminDictionary }) {
  const router = useRouter();
  async function undo(id: string) {
    if (!confirm(dict.confirmUndo)) return;
    const response = await fetch(`/api/admin/import/${id}`, { method: "DELETE", headers: { "x-csrf-token": csrfFromDocument() } });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error === "PUBLISHED_YEAR" ? dict.cannotUndoPublished : dict.errors);
    toast.success(dict.undoSuccess);
    router.refresh();
  }
  if (!rows.length) return <p className="muted p-8 text-center">{dict.noImports}</p>;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[var(--surface-2)]"><tr>{[dict.fileName,dict.examYear,dict.status,dict.validRows,dict.date,dict.checksum,""].map((heading,index)=><th className="p-4 text-start" key={`${heading}-${index}`}>{heading}</th>)}</tr></thead><tbody>{rows.map(row=><tr className="border-t" style={{borderColor:"var(--line)"}} key={row.id}><td className="p-4"><b>{row.fileName}</b><div className="muted text-xs">{row.adminEmail}</div></td><td className="p-4">{row.year}</td><td className="p-4"><span className={`badge ${row.status==="FAILED"?"fail":""}`}>{row.status==="IMPORTED"?dict.imported:row.status==="FAILED"?dict.statusFailed:dict.statusValidated}</span></td><td className="p-4">{row.validRows}/{row.totalRows}{row.invalidRows?` · ${row.invalidRows} ${dict.invalidRows}`:""}</td><td className="p-4" dir="ltr">{new Date(row.createdAt).toLocaleString()}</td><td className="max-w-44 truncate p-4 font-mono text-xs" title={row.checksum}>{row.checksum}</td><td className="p-4"><button className="button secondary !min-h-10 !text-[var(--danger)]" disabled={row.isPublished} title={row.isPublished?dict.cannotUndoPublished:undefined} onClick={()=>undo(row.id)}>{dict.undoImport}</button></td></tr>)}</tbody></table></div>;
}
