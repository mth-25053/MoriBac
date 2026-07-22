import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VISITOR_COOKIE, recordPageView } from "@/lib/analytics";
import { isRateLimited } from "@/lib/rate-limit";
import { pageViewSchema } from "@/lib/validation";

const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Public, unauthenticated by design (fired from every visitor's browser).
 * Failures and rate-limiting are swallowed silently - tracking must never surface
 * an error to a real visitor or slow down their page.
 */
export async function POST(request: Request) {
  if (isRateLimited(request, "track-pageview", 60, 60_000)) return NextResponse.json({ ok: true });

  const parsed = pageViewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const jar = await cookies();
  const existingVisitorId = jar.get(VISITOR_COOKIE)?.value;
  const visitorId = existingVisitorId ?? randomUUID();

  const response = NextResponse.json({ ok: true });
  if (!existingVisitorId) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE
    });
  }

  await recordPageView(request, parsed.data.path, visitorId);
  return response;
}
