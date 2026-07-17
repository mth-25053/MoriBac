import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = (emailArg || process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = passwordArg || process.env.SEED_ADMIN_PASSWORD || "";

  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    throw new Error("Usage: npm run admin:create -- admin@example.mr 'a-password-with-12+-characters'");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.admin.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });
    console.log(`Administrator ${email} is ready.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Administrator creation failed.");
  process.exitCode = 1;
});