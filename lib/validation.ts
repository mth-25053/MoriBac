import { z } from "zod";
import { DECISIONS } from "@/lib/constants";

export const candidateSearchSchema = z.object({
  number: z.string().trim().min(1).max(50).regex(/^\d+$/)
});

export const candidateNameSearchSchema = z.object({
  query: z.string().trim().min(2).max(100)
});

export const browseSchema = z.object({
  series: z.string().trim().max(100).optional().default(""),
  wilaya: z.string().trim().max(150).optional().default(""),
  center: z.string().trim().max(250).optional().default(""),
  school: z.string().trim().max(250).optional().default(""),
  name: z.string().trim().max(100).optional().default(""),
  sort: z.enum(["highest", "lowest", "name", "number"]).optional().default("highest"),
  page: z.coerce.number().int().positive().max(10000).optional().default(1),
  year: z.coerce.number().int().min(2000).max(2100).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200)
});

export const yearSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  session: z.enum(["NORMAL", "COMPLEMENTAIRE"]).optional().default("NORMAL")
});

export const settingsSchema = z.object({
  siteNoticeAr: z.string().trim().max(500),
  siteNoticeFr: z.string().trim().max(500)
}).strict();

export const decisionMappingCreateSchema = z.object({
  rawValue: z.string().trim().min(1).max(200),
  decision: z.enum(DECISIONS)
}).strict();

export const decisionMappingUpdateSchema = z.object({
  decision: z.enum(DECISIONS)
}).strict();

export const importActionSchema = z.object({ action: z.literal("complete") }).strict();

export const knownSeriesCreateSchema = z.object({
  code: z.string().trim().min(1).max(100)
}).strict();

export const pageViewSchema = z.object({
  path: z.string().trim().min(1).max(200)
}).strict();

export const subjectSchemeCreateSchema = z.object({
  examYearId: z.string().trim().min(1),
  series: z.string().trim().min(1).max(50),
  subjectCode: z.string().trim().min(1).max(20),
  nameAr: z.string().trim().max(200).nullable().optional(),
  nameFr: z.string().trim().max(200).nullable().optional(),
  coefficient: z.coerce.number().min(0).max(99.99).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).max(1000)
}).strict();

export const subjectSchemeUpdateSchema = z.object({
  nameAr: z.string().trim().max(200).nullable().optional(),
  nameFr: z.string().trim().max(200).nullable().optional(),
  coefficient: z.coerce.number().min(0).max(99.99).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).max(1000).optional()
}).strict();

export const subjectSchemeDiscoveryConfirmSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  schemes: z.array(z.object({
    series: z.string().trim().min(1).max(50),
    subjectCode: z.string().trim().min(1).max(20),
    nameAr: z.string().trim().max(200).nullable().optional(),
    nameFr: z.string().trim().max(200).nullable().optional(),
    coefficient: z.coerce.number().min(0).max(99.99).nullable().optional(),
    displayOrder: z.coerce.number().int().min(0).max(1000)
  }).strict()).min(1).max(500)
}).strict();
