import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { clearSearchHistory } from "@/lib/analytics";
import { databaseUnavailable } from "@/lib/database-errors";
import { authorizeMutation } from "@/lib/http";
import { clientIp } from "@/lib/security";

export async function DELETE(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  try {
    await clearSearchHistory();
    await recordAudit({
      adminId: auth.session.adminId,
      action: "search-history.clear",
      targetType: "SearchLog",
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseUnavailable(error, "search-history-clear");
  }
}
