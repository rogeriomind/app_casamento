import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  photo: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $disconnect: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/lib/bunny-storage", () => ({
  deleteBunnyObject: vi.fn(async () => undefined),
  downloadBunnyObject: vi.fn(async () => Buffer.from("original")),
  getBunnyObjectPathFromPublicUrl: vi.fn(
    () => "clients/hash/photos/from-url.jpg",
  ),
}));

vi.mock("../src/lib/photo-storage", () => ({
  createAndUploadPhotoThumbnail: vi.fn(async () => ({
    thumbnailUrl: "https://cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
    thumbnailObjectPath: "clients/hash/thumbnails/photo-thumb.webp",
    thumbnailSizeInBytes: 48_000,
    thumbnailWidth: 720,
    thumbnailHeight: 480,
  })),
}));

import { deleteBunnyObject, downloadBunnyObject } from "../src/lib/bunny-storage";
import { createAndUploadPhotoThumbnail } from "../src/lib/photo-storage";
import { parseBackfillArgs, runBackfill } from "./backfill-photo-thumbnails";

function photo(overrides: Record<string, unknown> = {}) {
  return {
    id: "photo-1",
    eventId: "event-1",
    imageUrl: "https://cdn.example.com/clients/hash/photos/photo.jpg",
    imageObjectPath: "clients/hash/photos/photo.jpg",
    thumbnailUrl: null,
    thumbnailObjectPath: null,
    originalFileName: "foto.jpg",
    mimeType: "image/jpeg",
    event: {
      storagePrefix: "clients/hash",
    },
    ...overrides,
  };
}

describe("photo thumbnail backfill script", () => {
  beforeEach(() => {
    prismaMock.photo.findMany.mockReset();
    prismaMock.photo.update.mockReset();
    vi.mocked(deleteBunnyObject).mockClear();
    vi.mocked(downloadBunnyObject).mockClear();
    vi.mocked(createAndUploadPhotoThumbnail).mockClear();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses dry-run and batching options", () => {
    expect(
      parseBackfillArgs([
        "--dry-run",
        "--limit",
        "10",
        "--batch-size",
        "5",
        "--event-id",
        "event-1",
      ]),
    ).toEqual({
      dryRun: true,
      regenerateNonWebp: false,
      limit: 10,
      batchSize: 5,
      eventId: "event-1",
    });
  });

  it("does not download, upload or update records in dry-run mode", async () => {
    prismaMock.photo.findMany
      .mockResolvedValueOnce([photo()])
      .mockResolvedValueOnce([]);

    const stats = await runBackfill({
      dryRun: true,
      regenerateNonWebp: false,
      batchSize: 20,
    });

    expect(stats).toMatchObject({
      scanned: 1,
      candidates: 1,
      backfilled: 0,
      skipped: 1,
      failed: 0,
    });
    expect(downloadBunnyObject).not.toHaveBeenCalled();
    expect(createAndUploadPhotoThumbnail).not.toHaveBeenCalled();
    expect(prismaMock.photo.update).not.toHaveBeenCalled();
  });

  it("generates and persists missing thumbnails without changing originals", async () => {
    prismaMock.photo.findMany
      .mockResolvedValueOnce([photo()])
      .mockResolvedValueOnce([]);

    const stats = await runBackfill({
      dryRun: false,
      regenerateNonWebp: false,
      batchSize: 20,
    });

    expect(stats.backfilled).toBe(1);
    expect(downloadBunnyObject).toHaveBeenCalledWith(
      "clients/hash/photos/photo.jpg",
    );
    expect(createAndUploadPhotoThumbnail).toHaveBeenCalledWith({
      originalBuffer: Buffer.from("original"),
      storagePrefix: "clients/hash",
      objectBaseName: "photo-1",
      source: {
        name: "foto.jpg",
        type: "image/jpeg",
      },
    });
    expect(prismaMock.photo.update).toHaveBeenCalledWith({
      where: { id: "photo-1" },
      data: {
        thumbnailUrl:
          "https://cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
        thumbnailObjectPath: "clients/hash/thumbnails/photo-thumb.webp",
      },
    });
  });

  it("skips records that already have a thumbnail if they are encountered again", async () => {
    prismaMock.photo.findMany
      .mockResolvedValueOnce([
        photo({
          thumbnailUrl: "https://cdn.example.com/thumb.webp",
          thumbnailObjectPath: "clients/hash/thumbnails/thumb.webp",
        }),
      ])
      .mockResolvedValueOnce([]);

    const stats = await runBackfill({
      dryRun: false,
      regenerateNonWebp: false,
      batchSize: 20,
    });

    expect(stats.skipped).toBe(1);
    expect(downloadBunnyObject).not.toHaveBeenCalled();
    expect(createAndUploadPhotoThumbnail).not.toHaveBeenCalled();
    expect(prismaMock.photo.update).not.toHaveBeenCalled();
  });

  it("regenerates non-WebP thumbnails when requested and cleans up the old object", async () => {
    prismaMock.photo.findMany
      .mockResolvedValueOnce([
        photo({
          thumbnailUrl: "https://cdn.example.com/clients/hash/thumbnails/old.jpg",
          thumbnailObjectPath: "clients/hash/thumbnails/old.jpg",
        }),
      ])
      .mockResolvedValueOnce([]);

    const stats = await runBackfill({
      dryRun: false,
      regenerateNonWebp: true,
      batchSize: 20,
    });

    expect(stats.backfilled).toBe(1);
    expect(createAndUploadPhotoThumbnail).toHaveBeenCalledTimes(1);
    expect(prismaMock.photo.update).toHaveBeenCalledWith({
      where: { id: "photo-1" },
      data: {
        thumbnailUrl:
          "https://cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
        thumbnailObjectPath: "clients/hash/thumbnails/photo-thumb.webp",
      },
    });
    expect(deleteBunnyObject).toHaveBeenCalledWith(
      "clients/hash/thumbnails/old.jpg",
    );
  });
});
