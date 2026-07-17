import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "";

  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) before seeding.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.admin.upsert({
      where: { email },
      create: { email, passwordHash },
      update: { passwordHash }
    });
    console.log("Seed administrator created.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Administrator seed failed.");
  process.exitCode = 1;
});