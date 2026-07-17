import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function developmentDatabaseUrl() {
  if (process.env.NODE_ENV !== "development" || !process.env.DIRECT_URL) return undefined;
  try {
    const url = new URL(process.env.DIRECT_URL);
    url.searchParams.set("connection_limit", "5");
    url.searchParams.set("pool_timeout", "30");
    url.searchParams.set("connect_timeout", "10");
    return url.toString();
  } catch {
    return process.env.DIRECT_URL;
  }
}

const developmentUrl = developmentDatabaseUrl();

export const db = globalForPrisma.prisma ?? new PrismaClient({
  ...(developmentUrl ? { datasources: { db: { url: developmentUrl } } } : {}),
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;