import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Static (non-variable) TTFs only. A variable-weight TTF (e.g. Google Fonts'
 * "[wght]" axis files) was tried first and produced silently wrong Arabic glyphs
 * (dropped/substituted letters, not just wrong weight) under @react-pdf/renderer's
 * fontkit-based shaping - confirmed by rendering and visually inspecting a test PDF.
 *
 * Amiri (a calligraphic Naskh typeface) was tried next and was correct for nearly
 * every Arabic string tested, but has a reproducible ligature bug specific to the
 * word "ناجح" ("ADMIS"/passed - the single most important decision label in this
 * app) in both weights: it renders as a collapsed, illegible glyph instead of four
 * connected letters. Confirmed by isolating the word alone in a minimal test PDF
 * and rendering every other decision/subject string correctly around it. Replaced
 * with Tajawal, a plain sans-serif Arabic font with no calligraphic ligature table,
 * verified correct (including "ناجح") the same way before being adopted here.
 */
const FONTS_DIR = path.join(process.cwd(), "public", "fonts", "pdf");

let registered = false;

export const PDF_FONT_ARABIC = "Tajawal";
export const PDF_FONT_LATIN = "Lato";

export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: PDF_FONT_ARABIC,
    fonts: [
      { src: path.join(FONTS_DIR, "Tajawal-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "Tajawal-Bold.ttf"), fontWeight: 700 }
    ]
  });
  Font.register({
    family: PDF_FONT_LATIN,
    fonts: [
      { src: path.join(FONTS_DIR, "Lato-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "Lato-Bold.ttf"), fontWeight: 700 }
    ]
  });
  // react-pdf hyphenates by default, which can break an unbroken Arabic/French word
  // across lines in a way that looks like a typo - disable it for this compact,
  // short-line document (candidate names, subject names, single-line rows).
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
