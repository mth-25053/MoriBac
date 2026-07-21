import { AuditLogTable } from "@/components/admin/audit-log-table";
import { db } from "@/lib/db";
import { adminDictionary } from "@/lib/admin-i18n";
import { getLocale } from "@/lib/i18n";

export default async function AuditPage() {
  const dict = adminDictionary(await getLocale());
  const entries = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const adminIds = [...new Set(entries.map((entry) => entry.adminId))];
  const admins = adminIds.length ? await db.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } }) : [];
  const emailById = new Map(admins.map((admin) => [admin.id, admin.email]));
  const rows = entries.map((entry) => ({
    id: entry.id,
    adminEmail: emailById.get(entry.adminId) ?? entry.adminId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    createdAt: entry.createdAt.toISOString()
  }));
  return <div>
    <span className="eyebrow">{dict.auditLogNav}</span>
    <h1 className="mt-2 text-3xl font-black">{dict.auditLogNav}</h1>
    <div className="surface mt-7 overflow-hidden"><AuditLogTable rows={rows} dict={dict} /></div>
  </div>;
}
