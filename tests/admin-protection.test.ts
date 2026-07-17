import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  validateCsrf: vi.fn(),
  assertSameOrigin: vi.fn(),
  findAdmin: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ readSession: mocks.readSession, validateCsrf: mocks.validateCsrf }));
vi.mock("@/lib/security", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/db", () => ({ db: { admin: { findUnique: mocks.findAdmin } } }));

import { authorizeMutation } from "@/lib/http";

describe("administrator API protection", () => {
  const request = new Request("https://moribac.test/api/admin/settings", { method: "PUT", headers: { origin: "https://moribac.test", host: "moribac.test" } });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockReturnValue(true);
    mocks.validateCsrf.mockResolvedValue(true);
    mocks.findAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("rejects an anonymous mutation", async () => {
    mocks.readSession.mockResolvedValue(null);
    const result = await authorizeMutation(request);
    if (!("error" in result) || !result.error) throw new Error("Expected authorization error");
    expect(result.error.status).toBe(401);
  });

  it("rejects missing or invalid CSRF/origin protection", async () => {
    mocks.readSession.mockResolvedValue({ adminId: "admin-1", email: "admin@example.mr" });
    mocks.validateCsrf.mockResolvedValue(false);
    const result = await authorizeMutation(request);
    if (!("error" in result) || !result.error) throw new Error("Expected authorization error");
    expect(result.error.status).toBe(403);
  });

  it("rejects a validly signed session when the admin no longer exists", async () => {
    mocks.readSession.mockResolvedValue({ adminId: "deleted", email: "admin@example.mr" });
    mocks.findAdmin.mockResolvedValue(null);
    const result = await authorizeMutation(request);
    if (!("error" in result) || !result.error) throw new Error("Expected authorization error");
    expect(result.error.status).toBe(401);
  });

  it("accepts a valid session, same-origin request, CSRF token, and existing admin", async () => {
    const session = { adminId: "admin-1", email: "admin@example.mr" };
    mocks.readSession.mockResolvedValue(session);
    await expect(authorizeMutation(request)).resolves.toEqual({ session });
  });
});
