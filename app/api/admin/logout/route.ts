import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { authorizeMutation } from "@/lib/http";

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if ("error" in auth) return auth.error;
  await clearSession();
  return NextResponse.json({ ok: true });
}
