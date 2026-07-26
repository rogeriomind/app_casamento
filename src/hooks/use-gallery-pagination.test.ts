import { describe, expect, it } from "vitest";
import { mergeGalleryPhotos } from "@/hooks/use-gallery-pagination";
import type { PublicPhoto } from "@/types";

function photo(id: string, createdAt: string): PublicPhoto {
  return {
    id,
    imageUrl: `https://cdn.example.com/${id}.jpg`,
    thumbnailUrl: `https://cdn.example.com/${id}.webp`,
    guestName: "Maria",
    tags: [],
    likeCount: 0,
    isLiked: false,
    canDelete: false,
    createdAt,
  };
}

describe("mergeGalleryPhotos", () => {
  it("deduplicates photos and preserves descending cursor order", () => {
    const merged = mergeGalleryPhotos(
      [
        photo("photo-b", "2026-07-25T12:00:00.000Z"),
        photo("photo-a", "2026-07-25T11:00:00.000Z"),
      ],
      [
        photo("photo-c", "2026-07-25T13:00:00.000Z"),
        photo("photo-b", "2026-07-25T12:00:00.000Z"),
      ],
    );

    expect(merged.map((item) => item.id)).toEqual([
      "photo-c",
      "photo-b",
      "photo-a",
    ]);
  });
});
