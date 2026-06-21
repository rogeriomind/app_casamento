import { afterEach, describe, expect, it } from "vitest";
import {
  isAuthorizedAdminRequest,
  requireAdminRequest,
} from "@/lib/admin-auth";

describe("admin auth helpers", () => {
  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it("accepts requests with the configured bearer token", () => {
    process.env.ADMIN_API_KEY = "secret-key";
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer secret-key" },
    });

    expect(isAuthorizedAdminRequest(request)).toBe(true);
    expect(requireAdminRequest(request)).toBeNull();
  });

  it("rejects missing or invalid credentials", async () => {
    process.env.ADMIN_API_KEY = "secret-key";
    const request = new Request("https://example.com");
    const response = requireAdminRequest(request);

    expect(isAuthorizedAdminRequest(request)).toBe(false);
    expect(response).not.toBeNull();
    if (!response) {
      throw new Error("Expected unauthorized response");
    }
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
