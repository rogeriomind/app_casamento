import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  photo: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  guestSession: {
    findFirst: vi.fn(),
  },
  photoLike: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/photo-storage", () => ({
  processAndStorePhoto: vi.fn(),
  UploadValidationError: class UploadValidationError extends Error {},
}));

import { processAndStorePhoto } from "@/lib/photo-storage";
import { GET, POST } from "./route";

const context = {
  params: Promise.resolve({ eventKey: "event-1" }),
};

function photo(overrides: Partial<Parameters<typeof JSON.stringify>[0]> = {}) {
  return {
    id: "photo-1",
    eventId: "event-1",
    guestSessionId: "session-1",
    guestName: "Maria",
    mediaType: "image",
    imageUrl: "https://old-cdn.example.com/clients/hash/photos/photo.jpg",
    thumbnailUrl: null,
    imageObjectPath: null,
    thumbnailObjectPath: null,
    status: "published",
    streamVideoId: null,
    streamLibraryId: null,
    videoEmbedUrl: null,
    playbackUrl: null,
    durationSeconds: null,
    width: null,
    height: null,
    originalFileName: "foto.jpg",
    mimeType: "image/jpeg",
    sizeInBytes: 123,
    tags: "[]",
    likeCount: 0,
    isDemo: false,
    createdAt: new Date("2026-07-25T12:00:00.000Z"),
    ...overrides,
  };
}

describe("GET /api/events/[eventKey]/photos", () => {
  beforeEach(() => {
    process.env.BUNNY_STORAGE_ENDPOINT =
      "https://storage.example.com/app-casamento";
    process.env.BUNNY_STORAGE_PASSWORD = "storage-secret";
    process.env.BUNNY_PUBLIC_BASE_URL = "https://new-cdn.example.com";
    prismaMock.event.findUnique.mockReset();
    prismaMock.photo.findMany.mockReset();
    prismaMock.photo.create.mockReset();
    prismaMock.guestSession.findFirst.mockReset();
    prismaMock.photoLike.findMany.mockReset();
    vi.mocked(processAndStorePhoto).mockReset();
  });

  it("does not hide legacy public URLs when the Bunny Pull Zone changes", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.photo.findMany.mockResolvedValueOnce([
      photo(),
      photo({
        id: "photo-2",
        imageObjectPath: "clients/hash/photos/photo-2.jpg",
        thumbnailObjectPath: "clients/hash/thumbnails/photo-2-thumb.jpg",
      }),
    ]);

    const response = await GET(
      new Request("http://localhost/api/events/event-1/photos?limit=16"),
      context,
    );
    const data = await response.json();
    const findManyArgs = prismaMock.photo.findMany.mock.calls[0][0];

    expect(findManyArgs.where.imageUrl).toBeUndefined();
    expect(data.items).toEqual([
      expect.objectContaining({
        id: "photo-1",
        imageUrl: "https://old-cdn.example.com/clients/hash/photos/photo.jpg",
      }),
      expect.objectContaining({
        id: "photo-2",
        imageUrl: "https://new-cdn.example.com/clients/hash/photos/photo-2.jpg",
        thumbnailUrl:
          "https://new-cdn.example.com/clients/hash/thumbnails/photo-2-thumb.jpg",
      }),
    ]);
  });

  it("persists and serializes the original and thumbnail URLs on upload", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
      storagePrefix: "clients/hash",
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      eventId: "event-1",
      guestName: "Maria",
    });
    vi.mocked(processAndStorePhoto).mockResolvedValueOnce({
      imageUrl: "https://new-cdn.example.com/clients/hash/photos/photo.png",
      thumbnailUrl:
        "https://new-cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
      imageObjectPath: "clients/hash/photos/photo.png",
      thumbnailObjectPath: "clients/hash/thumbnails/photo-thumb.webp",
      mimeType: "image/png",
      sizeInBytes: 1234,
      originalFileName: "foto.png",
    });
    prismaMock.photo.create.mockImplementationOnce(async ({ data }) =>
      photo({
        id: "photo-new",
        ...data,
        tags: data.tags,
        createdAt: new Date("2026-07-25T12:00:00.000Z"),
      }),
    );

    const formData = new FormData();
    formData.set("guestSessionId", "session-1");
    formData.set("tags", JSON.stringify(["noivos"]));
    formData.set(
      "file",
      new File([Buffer.from("fake")], "foto.png", { type: "image/png" }),
    );

    const response = await POST(
      { formData: async () => formData } as Request,
      context,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(processAndStorePhoto).toHaveBeenCalledWith(
      expect.any(File),
      "clients/hash",
    );
    expect(prismaMock.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mediaType: "image",
        imageUrl: "https://new-cdn.example.com/clients/hash/photos/photo.png",
        thumbnailUrl:
          "https://new-cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
        imageObjectPath: "clients/hash/photos/photo.png",
        thumbnailObjectPath: "clients/hash/thumbnails/photo-thumb.webp",
        mimeType: "image/png",
        sizeInBytes: 1234,
      }),
    });
    expect(data).toMatchObject({
      id: "photo-new",
      imageUrl: "https://new-cdn.example.com/clients/hash/photos/photo.png",
      thumbnailUrl:
        "https://new-cdn.example.com/clients/hash/thumbnails/photo-thumb.webp",
    });
  });
});
