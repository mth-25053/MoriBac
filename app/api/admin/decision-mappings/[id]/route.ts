import { NextResponse } from "next/server";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { DecisionMappingRepository } from "@/lib/excel/decision-mapping-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { decisionMappingUpdateSchema } from "@/lib/validation";

const repository = new DecisionMappingRepository();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = decisionMappingUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_DECISION_MAPPING");
  try {
    const mapping = await repository.resolve(id, parsed.data.decision);
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
    await repository.delete(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "decision-mapping-delete");
    return apiError("DECISION_MAPPING_NOT_FOUND", 404);
  }
}
