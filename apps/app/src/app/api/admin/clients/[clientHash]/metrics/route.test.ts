import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  guestSession: {
    count: vi.fn(),
  },
  photo: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET } from "./route";

function createRequest(authorization = "Bearer admin-key") {
  return new Request("http://localhost/api/admin/clients/hash123/metrics", {
    headers: { authorization },
  });
}

const context = {
  params: Promise.resolve({ clientHash: "hash123" }),
};

describe("GET /api/admin/clients/[clientHash]/metrics", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "admin-key";
    prismaMock.event.findUnique.mockReset();
    prismaMock.photo.count.mockReset();
    prismaMock.guestSession.count.mockReset();
  });

  it("returns metrics for a client", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      clientHash: "hash123",
      clientNumber: "CLI-001",
    });
    prismaMock.photo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(12);
    prismaMock.guestSession.count.mockResolvedValueOnce(3).mockResolvedValueOnce(25);

    const response = await GET(createRequest(), context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      clientHash: "hash123",
      clientNumber: "CLI-001",
      photos: { published: 10, total: 12 },
      users: { online: 3, entered: 25 },
      onlineWindowSeconds: 120,
    });
    expect(prismaMock.guestSession.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: "event-1",
          lastSeenAt: { gte: expect.any(Date) },
          deviceId: { not: null },
        }),
      }),
    );
  });

  it("rejects unauthorized requests", async () => {
    const response = await GET(createRequest("Bearer wrong"), context);

    expect(response.status).toBe(401);
    expect(prismaMock.event.findUnique).not.toHaveBeenCalled();
  });
});
