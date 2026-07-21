import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { db } from "@/lib/db";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { decisionMappingUpdateSchema } from "@/lib/validation";

const repository = new DecisionMappingRepository();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = decisionMappingUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_DECISION_MAPPING");
  try {
    const existing = await db.decisionMapping.findUnique({ where: { id } });
    const mapping = await repository.resolve(id, parsed.data.decision);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "decision-mapping.update",
      targetType: "DecisionMapping",
      targetId: id,
      previousValue: existing ? { rawValue: existing.rawValue, decision: existing.decision } : null,
      newValue: { decision: parsed.data.decision },
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, mapping });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "decision-mapping-update");
    return apiError("DECISION_MAPPING_NOT_FOUND", 404);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const existing = await db.decisionMapping.findUnique({ where: { id } });
    await repository.delete(id);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "decision-mapping.delete",
      targetType: "DecisionMapping",
      targetId: id,
      previousValue: existing ? { rawValue: existing.rawValue, decision: existing.decision } : null,
      newValue: null,
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "decision-mapping-delete");
    return apiError("DECISION_MAPPING_NOT_FOUND", 404);
  }
}
