import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteBunnyObject, uploadBunnyObject } from "@/lib/bunny-storage";
import {
  createPhotoThumbnail,
  IMMUTABLE_IMAGE_CACHE_CONTROL,
  PHOTO_THUMBNAIL_MAX_DIMENSION,
  processAndStorePhoto,
} from "@/lib/photo-storage";

const heicConvertMock = vi.hoisted(() =>
  vi.fn(async () =>
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  ),
);

vi.mock("heic-convert", () => ({
  default: heicConvertMock,
}));

vi.mock("@/lib/bunny-storage", () => ({
  deleteBunnyObject: vi.fn(async () => undefined),
  uploadBunnyObject: vi.fn(
    async (objectPath: string) => `https://cdn.example.com/${objectPath}`,
  ),
}));

function fileFromBuffer(buffer: Buffer, name: string, type: string) {
  return {
    name,
    size: buffer.byteLength,
    type,
    arrayBuffer: async () =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
  } as File;
}

async function createImageBuffer({
  width,
  height,
  format = "png",
}: {
  width: number;
  height: number;
  format?: "jpeg" | "png" | "webp";
}) {
  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#ffffff",
    },
  });

  if (format === "jpeg") {
    return pipeline.jpeg().toBuffer();
  }

  if (format === "webp") {
    return pipeline.webp().toBuffer();
  }

  return pipeline.png().toBuffer();
}

async function createImageFile() {
  const buffer = await createImageBuffer({ width: 64, height: 64 });
  return fileFromBuffer(buffer, "foto.png", "image/png");
}

describe("photo thumbnail generation", () => {
  beforeEach(() => {
    heicConvertMock.mockClear();
  });

  it("generates WebP thumbnails within the maximum dimensions", async () => {
    const originalBuffer = await createImageBuffer({
      width: 1440,
      height: 720,
    });
    const thumbnail = await createPhotoThumbnail(originalBuffer, {
      name: "panorama.png",
      type: "image/png",
    });
    const metadata = await sharp(thumbnail.buffer).metadata();

    expect(thumbnail.contentType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(thumbnail.width).toBeLessThanOrEqual(PHOTO_THUMBNAIL_MAX_DIMENSION);
    expect(thumbnail.height).toBeLessThanOrEqual(PHOTO_THUMBNAIL_MAX_DIMENSION);
    expect(thumbnail.width).toBe(720);
    expect(thumbnail.height).toBe(360);
    expect(thumbnail.sizeInBytes).toBe(thumbnail.buffer.byteLength);
  });

  it("preserves proportions and does not enlarge small images", async () => {
    const originalBuffer = await createImageBuffer({ width: 64, height: 48 });
    const thumbnail = await createPhotoThumbnail(originalBuffer, {
      name: "pequena.png",
      type: "image/png",
    });

    expect(thumbnail.width).toBe(64);
    expect(thumbnail.height).toBe(48);
    expect(thumbnail.width / thumbnail.height).toBeCloseTo(64 / 48, 2);
  });

  it("applies EXIF orientation before resizing", async () => {
    const orientedBuffer = await sharp({
      create: {
        width: 600,
        height: 900,
        channels: 3,
        background: "#ffffff",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const thumbnail = await createPhotoThumbnail(orientedBuffer, {
      name: "orientada.jpg",
      type: "image/jpeg",
    });

    expect(thumbnail.width).toBe(720);
    expect(thumbnail.height).toBe(480);
  });
});

describe("processAndStorePhoto", () => {
  beforeEach(() => {
    vi.mocked(deleteBunnyObject).mockClear();
    vi.mocked(uploadBunnyObject).mockReset();
    vi.mocked(uploadBunnyObject).mockImplementation(
      async (objectPath: string) => `https://cdn.example.com/${objectPath}`,
    );
    heicConvertMock.mockClear();
  });

  it("uploads the original image and a WebP thumbnail to Bunny", async () => {
    const file = await createImageFile();
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const storedPhoto = await processAndStorePhoto(file, "clients/hash-123");

    expect(uploadBunnyObject).toHaveBeenCalledTimes(2);

    const [imagePath, imageBuffer, imageOptions] =
      vi.mocked(uploadBunnyObject).mock.calls[0];
    const [thumbnailPath, thumbnailBuffer, thumbnailOptions] =
      vi.mocked(uploadBunnyObject).mock.calls[1];
    const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();

    expect(imagePath).toMatch(/^clients\/hash-123\/photos\/[0-9a-f-]+\.png$/);
    expect(imageBuffer).toEqual(originalBuffer);
    expect(imageOptions).toMatchObject({
      contentType: "image/png",
      cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
    });
    expect(thumbnailPath).toMatch(
      /^clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.webp$/,
    );
    expect(thumbnailOptions).toMatchObject({
      contentType: "image/webp",
      cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
    });
    expect(thumbnailMetadata.format).toBe("webp");
    expect(storedPhoto.imageUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/clients\/hash-123\/photos\/[0-9a-f-]+\.png$/,
    );
    expect(storedPhoto.thumbnailUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.webp$/,
    );
    expect(storedPhoto.imageObjectPath).toMatch(
      /^clients\/hash-123\/photos\/[0-9a-f-]+\.png$/,
    );
    expect(storedPhoto.thumbnailObjectPath).toMatch(
      /^clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.webp$/,
    );
    expect(storedPhoto.mimeType).toBe("image/png");
    expect(storedPhoto.originalFileName).toBe("foto.png");
    expect(storedPhoto.sizeInBytes).toBe(originalBuffer.byteLength);
    expect(deleteBunnyObject).not.toHaveBeenCalled();
  });

  it("converts HEIC only for thumbnail processing and keeps the original file", async () => {
    const heicBuffer = Buffer.from("not-a-real-heic");
    const file = fileFromBuffer(heicBuffer, "foto.heic", "image/heic");

    const storedPhoto = await processAndStorePhoto(file, "clients/hash-123");
    const [imagePath, imageBuffer, imageOptions] =
      vi.mocked(uploadBunnyObject).mock.calls[0];

    expect(heicConvertMock).toHaveBeenCalledWith({
      buffer: heicBuffer,
      format: "JPEG",
      quality: 0.9,
    });
    expect(imagePath).toMatch(/^clients\/hash-123\/photos\/[0-9a-f-]+\.heic$/);
    expect(imageBuffer).toEqual(heicBuffer);
    expect(imageOptions).toMatchObject({
      contentType: "image/heic",
      cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
    });
    expect(storedPhoto.mimeType).toBe("image/heic");
    expect(storedPhoto.sizeInBytes).toBe(heicBuffer.byteLength);
    expect(uploadBunnyObject).toHaveBeenCalledTimes(2);
  });

  it("accepts recoverable JPEGs without an end marker", async () => {
    const buffer = await createImageBuffer({
      width: 64,
      height: 64,
      format: "jpeg",
    });
    const truncatedBuffer = buffer.subarray(0, buffer.byteLength - 2);
    const file = fileFromBuffer(truncatedBuffer, "foto.jpg", "image/jpeg");

    const storedPhoto = await processAndStorePhoto(file, "clients/hash-123");

    expect(storedPhoto.mimeType).toBe("image/jpeg");
    expect(storedPhoto.sizeInBytes).toBe(truncatedBuffer.byteLength);
    expect(uploadBunnyObject).toHaveBeenCalledTimes(2);
  });

  it("cleans up the uploaded original if the thumbnail upload fails", async () => {
    const file = await createImageFile();
    vi.mocked(uploadBunnyObject)
      .mockResolvedValueOnce("https://cdn.example.com/photo.png")
      .mockRejectedValueOnce(new Error("Bunny failed"));

    await expect(processAndStorePhoto(file, "clients/hash-123")).rejects.toThrow(
      "Bunny failed",
    );

    expect(deleteBunnyObject).toHaveBeenCalledTimes(1);
    expect(deleteBunnyObject).toHaveBeenCalledWith(
      expect.stringMatching(/^clients\/hash-123\/photos\/[0-9a-f-]+\.png$/),
    );
  });
});
