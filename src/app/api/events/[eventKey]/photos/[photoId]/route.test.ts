import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  guestSession: {
    findFirst: vi.fn(),
  },
  photo: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/bunny-storage", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/bunny-storage")>(
      "@/lib/bunny-storage",
    );

  return {
    ...actual,
    deleteBunnyObject: vi.fn(async () => undefined),
  };
});

import { deleteBunnyObject } from "@/lib/bunny-storage";
import { DELETE } from "./route";

const context = {
  params: Promise.resolve({ eventKey: "event-1", photoId: "photo-1" }),
};

describe("DELETE /api/events/[eventKey]/photos/[photoId]", () => {
  beforeEach(() => {
    process.env.BUNNY_STORAGE_ENDPOINT =
      "https://storage.example.com/app-casamento";
    process.env.BUNNY_STORAGE_PASSWORD = "storage-secret";
    process.env.BUNNY_PUBLIC_BASE_URL = "https://cdn.example.com";
    prismaMock.event.findUnique.mockReset();
    prismaMock.guestSession.findFirst.mockReset();
    prismaMock.photo.findFirst.mockReset();
    prismaMock.photo.delete.mockReset();
    vi.mocked(deleteBunnyObject).mockClear();
  });

  it("deletes the database record and cleans up original and thumbnail objects", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      guestName: "Maria",
    });
    prismaMock.photo.findFirst.mockResolvedValueOnce({
      id: "photo-1",
      guestName: "Maria",
      imageUrl: "https://cdn.example.com/clients/hash/photos/photo.jpg",
      thumbnailUrl: "https://cdn.example.com/clients/hash/thumbnails/photo.webp",
      imageObjectPath: "clients/hash/photos/photo.jpg",
      thumbnailObjectPath: "clients/hash/thumbnails/photo.webp",
    });
    prismaMock.photo.delete.mockResolvedValueOnce({ id: "photo-1" });

    const response = await DELETE(
      new Request("http://localhost/api/events/event-1/photos/photo-1", {
        method: "DELETE",
        body: JSON.stringify({ guestSessionId: "session-1" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.photo.delete).toHaveBeenCalledWith({
      where: { id: "photo-1" },
    });
    expect(deleteBunnyObject).toHaveBeenCalledTimes(2);
    expect(deleteBunnyObject).toHaveBeenCalledWith(
      "clients/hash/photos/photo.jpg",
    );
    expect(deleteBunnyObject).toHaveBeenCalledWith(
      "clients/hash/thumbnails/photo.webp",
    );
  });
});
