export type ParsedUserAgent = { browser: string; os: string; device: string };

/** Compact, dependency-free User-Agent parser. Approximate by design - good enough for aggregate analytics, not for feature detection. */
export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };

  const browser = /EdgA?\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox"
    : /CriOS\//.test(ua) ? "Chrome"
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : "Other";

  const os = /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) && !/iPhone|iPad|iPod/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod|iOS/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "Other";

  const device = /iPad|Tablet(?!.*Mobile)/.test(ua) ? "Tablet"
    : /Mobi|iPhone|Android/.test(ua) ? "Mobile"
    : "Desktop";

  return { browser, os, device };
}
