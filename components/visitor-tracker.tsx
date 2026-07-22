"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Fires a best-effort, fire-and-forget page-view ping for public routes only. Never blocks rendering, never surfaces errors. */
export function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
