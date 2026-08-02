import { describe, expect, it } from "vitest";
import { serializePhoto } from "@/lib/serializers";

describe("serializePhoto", () => {
  it("serializes thumbnail URLs from Bunny object paths when available", () => {
    process.env.BUNNY_STORAGE_ENDPOINT =
      "https://storage.example.com/app-casamento";
    process.env.BUNNY_STORAGE_PASSWORD = "storage-secret";
    process.env.BUNNY_PUBLIC_BASE_URL = "https://cdn.example.com";

    const serialized = serializePhoto(
      {
        id: "photo-1",
        imageUrl: "https://old-cdn.example.com/photo.jpg",
        thumbnailUrl: "https://old-cdn.example.com/thumb.jpg",
        imageObjectPath: "clients/hash/photos/photo.jpg",
        thumbnailObjectPath: "clients/hash/thumbnails/photo-thumb.webp",
        guestName: "Maria",
        guestSessionId: "session-1",
        tags: "[]",
        likeCount: 0,
        createdAt: new Date("2026-07-25T12:00:00.000Z"),
      },
      false,
      false,
      { preferObjectPathUrls: true },
    );

    expect(serialized.thumbnailUrl).toBe(
      "https://cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
    );
  });
});
