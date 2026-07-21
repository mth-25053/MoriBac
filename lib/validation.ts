import { z } from "zod";
import { DECISIONS } from "@/lib/constants";

export const candidateSearchSchema = z.object({
  number: z.string().trim().min(1).max(50).regex(/^\d+$/)
});

export const browseSchema = z.object({
  series: z.string().trim().max(100).optional().default(""),
  wilaya: z.string().trim().max(150).optional().default(""),
  center: z.string().trim().max(250).optional().default(""),
  school: z.string().trim().max(250).optional().default(""),
  sort: z.enum(["highest", "lowest", "name", "number"]).optional().default("highest"),
  page: z.coerce.number().int().positive().max(10000).optional().default(1),
  year: z.coerce.number().int().min(2000).max(2100).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200)
});

export const yearSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100) });

export const settingsSchema = z.object({
  siteNoticeAr: z.string().trim().max(500),
  siteNoticeFr: z.string().trim().max(500)
});

export const decisionMappingCreateSchema = z.object({
  rawValue: z.string().trim().min(1).max(200),
  decision: z.enum(DECISIONS)
});

export const decisionMappingUpdateSchema = z.object({
  decision: z.enum(DECISIONS)
});

export const importActionSchema = z.object({ action: z.literal("complete") });
