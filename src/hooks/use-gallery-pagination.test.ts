import { describe, expect, it } from "vitest";
import {
  mergeGalleryPhotos,
  prependGalleryPhoto,
  removeGalleryPhoto,
  replaceGalleryPhoto,
} from "@/hooks/use-gallery-pagination";
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

  it("prepends a newly published photo without duplicating ids", () => {
    const inserted = prependGalleryPhoto(
      [
        photo("photo-b", "2026-07-25T12:00:00.000Z"),
        photo("photo-a", "2026-07-25T11:00:00.000Z"),
      ],
      photo("photo-b", "2026-07-25T12:30:00.000Z"),
    );

    expect(inserted.map((item) => item.id)).toEqual(["photo-b", "photo-a"]);
  });

  it("updates one liked photo without dropping loaded pages", () => {
    const untouchedPhoto = photo("photo-a", "2026-07-25T11:00:00.000Z");
    const updatedPhoto = {
      ...photo("photo-b", "2026-07-25T12:00:00.000Z"),
      isLiked: true,
      likeCount: 1,
    };
    const updated = replaceGalleryPhoto(
      [photo("photo-b", "2026-07-25T12:00:00.000Z"), untouchedPhoto],
      updatedPhoto,
    );

    expect(updated).toHaveLength(2);
    expect(updated[0]).toBe(updatedPhoto);
    expect(updated[1]).toBe(untouchedPhoto);
  });

  it("removes only the deleted photo", () => {
    const remaining = removeGalleryPhoto(
      [
        photo("photo-b", "2026-07-25T12:00:00.000Z"),
        photo("photo-a", "2026-07-25T11:00:00.000Z"),
      ],
      "photo-b",
    );

    expect(remaining.map((item) => item.id)).toEqual(["photo-a"]);
  });
});
