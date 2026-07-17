"use client";
import { CSRF_COOKIE } from "@/lib/constants";

export function csrfFromDocument() {
  return document.cookie.split("; ").find((row) => row.startsWith(`${CSRF_COOKIE}=`))?.split("=")[1] ?? "";
}