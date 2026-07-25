import type { Locale } from "@/lib/i18n";
import { formatAverage } from "@/lib/format";

const WIDTH = 1200;
const HEIGHT = 630;

const BRAND = {
  bgFrom: "#0c513c",
  bgTo: "#146b50",
  gold: "#e0b667",
  goldSoft: "#f7ecd7",
  panel: "#ffffff",
  text: "#15201c",
  muted: "#66736e"
};

function fontFamily(cssVar: string) {
  if (typeof document === "undefined") return "sans-serif";
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value ? `${value}, sans-serif` : "sans-serif";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type ShareCardCandidate = {
  fullName: string;
  candidateNumber: string;
  series: string;
  wilaya: string | null;
  average: number;
  decisionLabel: string;
  year: number;
  badgeLabel?: string;
};

/** Renders a fixed, on-brand share card client-side (no server round trip, no new dependency). Colors are hardcoded to the brand palette rather than read from the current theme, so a card shared from dark mode still looks correct to whoever opens it. */
export async function renderShareCard(candidate: ShareCardCandidate, locale: Locale, brandLabel: string, labels: { series: string; wilaya: string; average: string; year: string }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");

  const arabicFont = fontFamily("--font-arabic");
  const latinFont = fontFamily("--font-latin");
  const bodyFont = locale === "ar" ? arabicFont : latinFont;
  try { await document.fonts?.ready; } catch { /* best-effort */ }

  const rtl = locale === "ar";
  ctx.direction = rtl ? "rtl" : "ltr";

  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, BRAND.bgFrom);
  bg.addColorStop(1, BRAND.bgTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = BRAND.gold;
  ctx.beginPath();
  ctx.arc(WIDTH - 80, 60, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(60, HEIGHT - 40, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const panelX = 60;
  const panelY = 60;
  const panelW = WIDTH - 120;
  const panelH = HEIGHT - 120;
  ctx.fillStyle = BRAND.panel;
  roundRect(ctx, panelX, panelY, panelW, panelH, 32);
  ctx.fill();

  ctx.textAlign = "center";
  const centerX = WIDTH / 2;

  ctx.fillStyle = BRAND.bgTo;
  ctx.font = `800 30px ${bodyFont}`;
  ctx.fillText(brandLabel, centerX, panelY + 66);

  if (candidate.badgeLabel) {
    ctx.font = `800 24px ${bodyFont}`;
    ctx.fillStyle = "#8a6425";
    const metrics = ctx.measureText(candidate.badgeLabel);
    const padX = 22;
    const pillW = metrics.width + padX * 2;
    const pillY = panelY + 92;
    ctx.fillStyle = BRAND.goldSoft;
    roundRect(ctx, centerX - pillW / 2, pillY, pillW, 46, 23);
    ctx.fill();
    ctx.fillStyle = "#8a6425";
    ctx.fillText(candidate.badgeLabel, centerX, pillY + 31);
  }

  ctx.fillStyle = BRAND.text;
  ctx.font = `900 56px ${bodyFont}`;
  ctx.fillText(candidate.fullName, centerX, panelY + 220, panelW - 80);

  ctx.fillStyle = BRAND.bgTo;
  ctx.font = `900 110px ${latinFont}`;
  ctx.direction = "ltr";
  ctx.fillText(formatAverage(candidate.average), centerX, panelY + 340);
  ctx.direction = rtl ? "rtl" : "ltr";

  ctx.fillStyle = BRAND.text;
  ctx.font = `800 30px ${bodyFont}`;
  ctx.fillText(candidate.decisionLabel, centerX, panelY + 390);

  ctx.fillStyle = BRAND.muted;
  ctx.font = `700 26px ${bodyFont}`;
  const infoLine = [candidate.series, candidate.wilaya, `${labels.year} ${candidate.year}`].filter(Boolean).join("   •   ");
  ctx.fillText(infoLine, centerX, panelY + panelH - 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("CANVAS_EXPORT_FAILED"))), "image/png", 0.95);
  });
}
