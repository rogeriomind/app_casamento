import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeGalleryPhotos,
  prependGalleryPhoto,
  removeGalleryPhoto,
  replaceGalleryPhoto,
  useGalleryPagination,
} from "@/hooks/use-gallery-pagination";
import type { PaginatedPhotos, PublicPhoto } from "@/types";

function photo(id: string, createdAt: string): PublicPhoto {
  return {
    id,
    mediaType: "image",
    imageUrl: `https://cdn.example.com/${id}.jpg`,
    thumbnailUrl: `https://cdn.example.com/${id}.webp`,
    videoEmbedUrl: null,
    playbackUrl: null,
    durationSeconds: null,
    width: null,
    height: null,
    guestName: "Maria",
    tags: [],
    likeCount: 0,
    isLiked: false,
    canDelete: false,
    createdAt,
  };
}

function paginatedPhotos(
  items: PublicPhoto[],
  overrides: Partial<PaginatedPhotos> = {},
): PaginatedPhotos {
  return {
    items,
    page: 1,
    limit: 12,
    hasNextPage: false,
    nextCursor: null,
    ...overrides,
  };
}

function GalleryPaginationHarness({
  initialGallery,
}: {
  initialGallery: PaginatedPhotos;
}) {
  const { photos, hasNextPage, sentinelRef } = useGalleryPagination({
    eventId: "event-1",
    guestSessionId: null,
    initialGallery,
  });

  return createElement(
    "div",
    null,
    photos.map((item) =>
      createElement("span", { key: item.id }, item.id),
    ),
    hasNextPage
      ? createElement("div", {
          "data-testid": "gallery-sentinel",
          ref: sentinelRef,
        })
      : null,
  );
}

beforeEach(() => {
  class MockIntersectionObserver {
    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe() {
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }

    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal(
    "IntersectionObserver",
    MockIntersectionObserver,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("loads the next 12 photos when the sentinel reaches the viewport", async () => {
    const initialItems = Array.from({ length: 12 }, (_, index) =>
      photo(
        `photo-${String(index + 1).padStart(2, "0")}`,
        `2026-07-25T12:${String(59 - index).padStart(2, "0")}:00.000Z`,
      ),
    );
    const nextItems = Array.from({ length: 12 }, (_, index) =>
      photo(
        `photo-${String(index + 13).padStart(2, "0")}`,
        `2026-07-25T11:${String(59 - index).padStart(2, "0")}:00.000Z`,
      ),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        paginatedPhotos(nextItems, {
          page: 2,
          hasNextPage: false,
          nextCursor: null,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      createElement(GalleryPaginationHarness, {
        initialGallery: paginatedPhotos(initialItems, {
          hasNextPage: true,
          nextCursor: "cursor-page-2",
        }),
      }),
    );

    await waitFor(() => expect(screen.getByText("photo-24")).toBeVisible());

    expect(screen.getByText("photo-01")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("limit=12");
    expect(fetchMock.mock.calls[0][0]).toContain("page=2");
    expect(fetchMock.mock.calls[0][0]).toContain("cursor=cursor-page-2");
  });
});
