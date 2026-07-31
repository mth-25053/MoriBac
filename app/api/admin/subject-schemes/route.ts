import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { DuplicateSubjectSchemeError, serializeSubjectScheme, SubjectSchemeRepository } from "@/lib/grades/subject-scheme-repository";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { subjectSchemeCreateSchema } from "@/lib/validation";

const repository = new SubjectSchemeRepository();

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const parsed = subjectSchemeCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_SUBJECT_SCHEME");
  try {
    const scheme = await repository.create({
      examYearId: parsed.data.examYearId,
      examType: "bac",
      series: parsed.data.series,
      subjectCode: parsed.data.subjectCode,
      nameAr: parsed.data.nameAr ?? null,
      nameFr: parsed.data.nameFr ?? null,
      coefficient: parsed.data.coefficient ?? null,
      displayOrder: parsed.data.displayOrder
    });
    const serialized = serializeSubjectScheme(scheme);
    await recordAudit({
      adminId: auth.session.adminId,
      action: "subject-scheme.create",
      targetType: "SubjectScheme",
      targetId: scheme.id,
      newValue: serialized,
      ip: clientIp(request)
    });
    return NextResponse.json({ ok: true, scheme: serialized });
  } catch (error) {
    if (error instanceof DuplicateSubjectSchemeError) return apiError("DUPLICATE_SUBJECT_SCHEME", 409);
    if (isDatabaseError(error)) return databaseUnavailable(error, "subject-scheme-create");
    throw error;
  }
}
