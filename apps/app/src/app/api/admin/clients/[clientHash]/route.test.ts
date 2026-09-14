import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "./route";

describe("GET /api/admin/clients/:clientHash", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "admin-key";
    prismaMock.event.findUnique.mockReset();
  });

  it("returns event metadata for a valid client hash", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      clientHash: "hash123",
      storagePrefix: "clients/hash123",
      isActive: true,
    });

    const response = await GET(
      new Request("https://capture.example/api/admin/clients/hash123", { headers: { authorization: "Bearer admin-key" } }),
      { params: Promise.resolve({ clientHash: "hash123" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "event-1", clientHash: "hash123", storagePrefix: "clients/hash123", isActive: true });
    expect(prismaMock.event.findUnique).toHaveBeenCalledWith({
      where: { clientHash: "hash123" },
      select: { id: true, clientHash: true, storagePrefix: true, isActive: true },
    });
  });

  it("requires the existing admin authorization", async () => {
    const response = await GET(
      new Request("https://capture.example/api/admin/clients/hash123", { headers: { authorization: "Bearer wrong" } }),
      { params: Promise.resolve({ clientHash: "hash123" }) },
    );

    expect(response.status).toBe(401);
    expect(prismaMock.event.findUnique).not.toHaveBeenCalled();
  });
});
