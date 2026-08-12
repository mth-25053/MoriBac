import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { databaseUnavailable, isDatabaseError } from "@/lib/database-errors";
import { confirmDiscoveredSchemes } from "@/lib/grades/subject-discovery-service";
import { authorizeMutation, apiError } from "@/lib/http";
import { clientIp } from "@/lib/security";
import { subjectSchemeDiscoveryConfirmSchema } from "@/lib/validation";

const EXAM_TYPE = "bac";

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  const parsed = subjectSchemeDiscoveryConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_SCHEME_PROPOSALS");

  try {
    const examYear = await db.examYear.upsert({ where: { year_session: { year: parsed.data.year, session: "NORMAL" } }, create: { year: parsed.data.year }, update: {} });
    const schemes = parsed.data.schemes.map((scheme) => ({
      series: scheme.series,
      subjectCode: scheme.subjectCode,
      nameAr: scheme.nameAr ?? null,
      nameFr: scheme.nameFr ?? null,
      coefficient: scheme.coefficient ?? null,
      displayOrder: scheme.displayOrder
    }));
    const results = await confirmDiscoveredSchemes(examYear.id, EXAM_TYPE, schemes);

    await recordAudit({
      adminId: auth.session.adminId,
      action: "subject-scheme.discover-confirm",
      targetType: "SubjectScheme",
      targetId: examYear.id,
      newValue: {
        year: parsed.data.year,
        created: results.filter((r) => r.status === "created").length,
        duplicate: results.filter((r) => r.status === "duplicate").length,
        error: results.filter((r) => r.status === "error").length
      },
      ip: clientIp(request)
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    if (isDatabaseError(error)) return databaseUnavailable(error, "subject-scheme-discover-confirm");
    return apiError("CONFIRM_FAILED", 500);
  }
}
