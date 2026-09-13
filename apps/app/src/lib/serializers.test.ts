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
        mediaType: "image",
        imageUrl: "https://old-cdn.example.com/photo.jpg",
        thumbnailUrl: "https://old-cdn.example.com/thumb.jpg",
        videoEmbedUrl: null,
        playbackUrl: null,
        durationSeconds: null,
        width: null,
        height: null,
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

  it("serializes Bunny Stream videos without requiring an image URL", () => {
    const serialized = serializePhoto(
      {
        id: "photo-video-1",
        mediaType: "video",
        imageUrl: null,
        thumbnailUrl: "https://vz-example.b-cdn.net/video-guid/thumbnail.jpg",
        videoEmbedUrl:
          "https://player.mediadelivery.net/embed/123456/video-guid",
        playbackUrl: "https://player.mediadelivery.net/play/123456/video-guid",
        durationSeconds: 42,
        width: 1920,
        height: 1080,
        imageObjectPath: null,
        thumbnailObjectPath: null,
        guestName: "Maria",
        guestSessionId: "session-1",
        tags: JSON.stringify(["cerimonia"]),
        likeCount: 3,
        createdAt: new Date("2026-07-25T12:00:00.000Z"),
      },
      true,
      true,
      { preferObjectPathUrls: true },
    );

    expect(serialized).toMatchObject({
      id: "photo-video-1",
      mediaType: "video",
      imageUrl: null,
      thumbnailUrl: "https://vz-example.b-cdn.net/video-guid/thumbnail.jpg",
      videoEmbedUrl:
        "https://player.mediadelivery.net/embed/123456/video-guid",
      durationSeconds: 42,
      width: 1920,
      height: 1080,
      tags: ["cerimonia"],
      isLiked: true,
      canDelete: true,
    });
  });
});
