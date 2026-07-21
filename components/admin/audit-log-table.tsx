import type { AdminDictionary } from "@/lib/admin-i18n";

type AuditRow = { id: string; adminEmail: string; action: string; targetType: string; targetId: string | null; createdAt: string };

export function AuditLogTable({ rows, dict }: { rows: AuditRow[]; dict: AdminDictionary }) {
  if (!rows.length) return <p className="muted p-8 text-center">{dict.noAuditEntries}</p>;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[var(--surface-2)]"><tr>
    {[dict.date, dict.auditAdmin, dict.auditAction, dict.auditTarget].map((heading, index) => <th className="p-4 text-start" key={`${heading}-${index}`}>{heading}</th>)}
  </tr></thead><tbody>{rows.map((row) => <tr className="border-t" style={{ borderColor: "var(--line)" }} key={row.id}>
    <td className="p-4" dir="ltr">{new Date(row.createdAt).toLocaleString()}</td>
    <td className="p-4">{row.adminEmail}</td>
    <td className="p-4 font-mono text-xs">{row.action}</td>
    <td className="p-4 font-mono text-xs">{row.targetType}{row.targetId ? ` · ${row.targetId}` : ""}</td>
  </tr>)}</tbody></table></div>;
}
