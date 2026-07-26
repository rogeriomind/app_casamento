import { describe, expect, it } from "vitest";
import {
  buildGalleryCursorWhere,
  decodeGalleryCursor,
  encodeGalleryCursor,
  normalizeGalleryLimit,
} from "@/lib/gallery-pagination";

describe("gallery cursor pagination", () => {
  it("uses 12 photos as the default initial page size", () => {
    expect(normalizeGalleryLimit(null)).toBe(12);
  });

  it("caps overly large page sizes", () => {
    expect(normalizeGalleryLimit("500")).toBe(60);
  });

  it("round-trips createdAt and id cursors", () => {
    const createdAt = new Date("2026-07-25T12:00:00.000Z");
    const cursor = decodeGalleryCursor(
      encodeGalleryCursor({ createdAt, id: "photo-2" }),
    );

    expect(cursor).toMatchObject({ createdAt, id: "photo-2" });
  });

  it("builds tie-breaker filters for equal createdAt values", () => {
    const createdAt = new Date("2026-07-25T12:00:00.000Z");

    expect(buildGalleryCursorWhere({ createdAt, id: "photo-2" })).toEqual({
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: "photo-2" } },
      ],
    });
  });
});
