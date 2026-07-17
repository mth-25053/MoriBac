import { describe, expect, it, vi } from "vitest";
import { databaseErrorDetails, withDatabaseRetry } from "@/lib/database-retry";

function connectionError() {
  const error = new Error("Can't reach database server at db.example:6543");
  error.name = "PrismaClientInitializationError";
  return error;
}

describe("bounded database retry", () => {
  it("infers P1001 from Prisma initialization failures", () => {
    expect(databaseErrorDetails(connectionError())).toMatchObject({ code: "P1001", name: "PrismaClientInitializationError" });
  });

  it("recovers from transient pooler failures with exponential bounded retries", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(connectionError())
      .mockRejectedValueOnce(connectionError())
      .mockResolvedValue("ok");
    await expect(withDatabaseRetry(operation, "test", { maxAttempts: 3, timeoutMs: 100, baseDelayMs: 1 })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("never exceeds three attempts", async () => {
    const operation = vi.fn().mockRejectedValue(connectionError());
    await expect(withDatabaseRetry(operation, "test", { maxAttempts: 10, timeoutMs: 100, baseDelayMs: 1 })).rejects.toThrow("Can't reach database server");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("applies a strict timeout to each attempt", async () => {
    const operation = vi.fn(() => new Promise<string>(() => undefined));
    await expect(withDatabaseRetry(operation, "test-timeout", { maxAttempts: 3, timeoutMs: 5, baseDelayMs: 1 })).rejects.toThrow("database timeout");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});