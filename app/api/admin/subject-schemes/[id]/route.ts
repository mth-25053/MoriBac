import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { serializeSubjectScheme, SubjectSchemeInUseError, SubjectSchemeNotFoundError, SubjectSchemeRepository } from "@/lib/grades/subject-scheme-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { subjectSchemeUpdateSchema } from "@/lib/validation";

const repository = new SubjectSchemeRepository();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = subjectSchemeUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_SUBJECT_SCHEME");
  try {
    const scheme = await repository.update(id, parsed.data);
    const serialized = serializeSubjectScheme(scheme);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "subject-scheme.update",
      targetType: "SubjectScheme",
      targetId: id,
      newValue: serialized,
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, scheme: serialized });
  } catch (error) {
    if (error instanceof SubjectSchemeNotFoundError) return apiError("SUBJECT_SCHEME_NOT_FOUND", 404);
    if (isDatabaseError(error)) return databaseUnavailable(error, "subject-scheme-update");
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const removed = await repository.remove(id);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "subject-scheme.delete",
      targetType: "SubjectScheme",
      targetId: id,
      previousValue: serializeSubjectScheme(removed),
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SubjectSchemeInUseError) return apiError("SUBJECT_SCHEME_IN_USE", 409);
    if (error instanceof SubjectSchemeNotFoundError) return apiError("SUBJECT_SCHEME_NOT_FOUND", 404);
    if (isDatabaseError(error)) return databaseUnavailable(error, "subject-scheme-delete");
    throw error;
  }
}
