export const SESSION_COOKIE = "moribac_session";
export const CSRF_COOKIE = "moribac_csrf";
export const LANGUAGE_COOKIE = "moribac_language";
export const THEME_COOKIE = "moribac_theme";
export const PAGE_SIZE = 50;
export const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export const DECISIONS = ["ADMIS", "SESSIONNAIRE", "REDOUBLE", "ABSENT", "ANNULE"] as const;
export type DecisionValue = (typeof DECISIONS)[number];

export const NAME_SEARCH_LIMIT = 20;
export const NAME_SEARCH_MAX_WORDS = 6;
