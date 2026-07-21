import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable } from "@/lib/database-errors";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { decisionMappingCreateSchema } from "@/lib/validation";

const repository = new DecisionMappingRepository();

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const parsed = decisionMappingCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_DECISION_MAPPING");
  try {
    const mapping = await repository.createManual(parsed.data.rawValue, parsed.data.decision);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "decision-mapping.create",
      targetType: "DecisionMapping",
      targetId: mapping.id,
      newValue: { rawValue: parsed.data.rawValue, decision: parsed.data.decision },
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, mapping });
  } catch (error) {
    return databaseUnavailable(error, "decision-mapping-create");
  }
}
