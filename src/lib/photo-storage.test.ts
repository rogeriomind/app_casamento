import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteBunnyObject, uploadBunnyObject } from "@/lib/bunny-storage";
import { processAndStorePhoto } from "@/lib/photo-storage";

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

async function createImageFile() {
  const buffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();

  return fileFromBuffer(buffer, "foto.png", "image/png");
}

describe("processAndStorePhoto", () => {
  beforeEach(() => {
    vi.mocked(deleteBunnyObject).mockClear();
    vi.mocked(uploadBunnyObject).mockReset();
    vi.mocked(uploadBunnyObject).mockImplementation(
      async (objectPath: string) =>
        `https://cdn.example.com/${objectPath}`,
    );
    heicConvertMock.mockClear();
  });

  it("uploads the processed image and thumbnail to Bunny", async () => {
    const file = await createImageFile();
    const storedPhoto = await processAndStorePhoto(file, "clients/hash-123");

    expect(uploadBunnyObject).toHaveBeenCalledTimes(2);
    expect(uploadBunnyObject).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /^clients\/hash-123\/photos\/[0-9a-f-]+\.jpg$/,
      ),
      expect.any(Buffer),
    );
    expect(uploadBunnyObject).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /^clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.jpg$/,
      ),
      expect.any(Buffer),
    );
    expect(storedPhoto.imageUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/clients\/hash-123\/photos\/[0-9a-f-]+\.jpg$/,
    );
    expect(storedPhoto.thumbnailUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.jpg$/,
    );
    expect(storedPhoto.imageObjectPath).toMatch(
      /^clients\/hash-123\/photos\/[0-9a-f-]+\.jpg$/,
    );
    expect(storedPhoto.thumbnailObjectPath).toMatch(
      /^clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.jpg$/,
    );
    expect(storedPhoto.mimeType).toBe("image/jpeg");
    expect(storedPhoto.originalFileName).toBe("foto.png");
    expect(storedPhoto.sizeInBytes).toBeGreaterThan(0);
    expect(deleteBunnyObject).not.toHaveBeenCalled();
  });

  it("converts HEIC files before processing when Sharp cannot read them", async () => {
    const heicBuffer = Buffer.from("not-a-real-heic");
    const file = fileFromBuffer(heicBuffer, "foto.heic", "image/heic");

    const storedPhoto = await processAndStorePhoto(file, "clients/hash-123");

    expect(heicConvertMock).toHaveBeenCalledWith({
      buffer: heicBuffer,
      format: "JPEG",
      quality: 0.9,
    });
    expect(storedPhoto.mimeType).toBe("image/jpeg");
    expect(uploadBunnyObject).toHaveBeenCalledTimes(2);
  });

  it("accepts recoverable JPEGs without an end marker", async () => {
    const buffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: "#ffffff",
      },
    })
      .jpeg()
      .toBuffer();
    const file = fileFromBuffer(
      buffer.subarray(0, buffer.byteLength - 2),
      "foto.jpg",
      "image/jpeg",
    );

    const storedPhoto = await processAndStorePhoto(file, "clients/hash-123");

    expect(storedPhoto.mimeType).toBe("image/jpeg");
    expect(uploadBunnyObject).toHaveBeenCalledTimes(2);
  });

  it("cleans up the uploaded image if the thumbnail upload fails", async () => {
    const file = await createImageFile();
    vi.mocked(uploadBunnyObject)
      .mockResolvedValueOnce("https://cdn.example.com/photo.jpg")
      .mockRejectedValueOnce(new Error("Bunny failed"));

    await expect(processAndStorePhoto(file, "clients/hash-123")).rejects.toThrow(
      "Bunny failed",
    );

    expect(deleteBunnyObject).toHaveBeenCalledTimes(1);
    expect(deleteBunnyObject).toHaveBeenCalledWith(
      expect.stringMatching(/^clients\/hash-123\/photos\/[0-9a-f-]+\.jpg$/),
    );
  });
});
