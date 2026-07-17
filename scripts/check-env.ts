import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile(".env");

const required = ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "NEXT_PUBLIC_APP_URL"] as const;
const errors: string[] = [];

for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is missing`);
  else if (/YOUR_|PROJECT_REF|replace-with/i.test(value)) errors.push(`${name} still contains an example placeholder`);
}

for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
  const value = process.env[name];
  if (value) {
    try {
      const url = new URL(value);
      if (!["postgres:", "postgresql:"].includes(url.protocol)) errors.push(`${name} must be a PostgreSQL URL`);
    } catch {
      errors.push(`${name} is not a valid URL`);
    }
  }
}

if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) errors.push("AUTH_SECRET must contain at least 32 characters");

if (errors.length) {
  console.error("MoriBac environment is not ready:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("MoriBac environment variables are present and structurally valid. No database connection was attempted.");
}
