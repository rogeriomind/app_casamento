import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { POST } from "./route";

const validBody = {
  clientName: "Cliente XPTO",
  clientNumber: "cli-001",
  coupleName: "Leticia e Rogerio",
  eventDate: "2026-09-12T18:00:00.000Z",
  albumName: "Galeria do Casamento",
  monogram: "L+R",
  isActive: true,
};

function createRequest(body = validBody, authorization = "Bearer admin-key") {
  return new Request("http://localhost/api/admin/clients", {
    method: "POST",
    headers: {
      authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/clients", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "admin-key";
    process.env.CLIENT_HASH_SECRET = "hash-secret";
    process.env.APP_BASE_URL = "https://album.example.com";
    prismaMock.event.create.mockReset();
    prismaMock.event.findUnique.mockReset();
  });

  it("creates a new client instance", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prismaMock.event.create.mockResolvedValueOnce({
      id: "event-1",
      clientHash: "hash123",
      clientNumber: "CLI-001",
      storagePrefix: "clients/hash123",
    });

    const response = await POST(createRequest());
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientName: "Cliente XPTO",
          clientNumber: "CLI-001",
          slug: expect.any(String),
          storagePrefix: expect.stringMatching(/^clients\//),
        }),
      }),
    );
    expect(data).toMatchObject({
      id: "event-1",
      clientHash: "hash123",
      clientNumber: "CLI-001",
      publicUrl: "https://album.example.com/e/hash123",
      metricsUrl: "https://album.example.com/api/admin/clients/hash123/metrics",
      storagePrefix: "clients/hash123",
    });
  });

  it("returns the existing client for duplicate clientNumber", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      clientHash: "hash123",
      clientNumber: "CLI-001",
      storagePrefix: "clients/hash123",
    });

    const response = await POST(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
    expect(data.publicUrl).toBe("https://album.example.com/e/hash123");
  });

  it("rejects requests without the admin API key", async () => {
    const response = await POST(createRequest(validBody, "Bearer wrong"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toMatchObject({ code: "UNAUTHORIZED" });
    expect(prismaMock.event.findUnique).not.toHaveBeenCalled();
  });
});
