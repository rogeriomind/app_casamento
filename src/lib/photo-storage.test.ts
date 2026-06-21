import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteBunnyObject, uploadBunnyObject } from "@/lib/bunny-storage";
import { processAndStorePhoto } from "@/lib/photo-storage";

vi.mock("@/lib/bunny-storage", () => ({
  deleteBunnyObject: vi.fn(async () => undefined),
  uploadBunnyObject: vi.fn(
    async (objectPath: string) => `https://productpulse.b-cdn.net/${objectPath}`,
  ),
}));

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

  return {
    name: "foto.png",
    size: buffer.byteLength,
    type: "image/png",
    arrayBuffer: async () =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
  } as File;
}

describe("processAndStorePhoto", () => {
  beforeEach(() => {
    vi.mocked(deleteBunnyObject).mockClear();
    vi.mocked(uploadBunnyObject).mockReset();
    vi.mocked(uploadBunnyObject).mockImplementation(
      async (objectPath: string) =>
        `https://productpulse.b-cdn.net/${objectPath}`,
    );
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
      /^https:\/\/productpulse\.b-cdn\.net\/clients\/hash-123\/photos\/[0-9a-f-]+\.jpg$/,
    );
    expect(storedPhoto.thumbnailUrl).toMatch(
      /^https:\/\/productpulse\.b-cdn\.net\/clients\/hash-123\/thumbnails\/[0-9a-f-]+-thumb\.jpg$/,
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

  it("cleans up the uploaded image if the thumbnail upload fails", async () => {
    const file = await createImageFile();
    vi.mocked(uploadBunnyObject)
      .mockResolvedValueOnce("https://productpulse.b-cdn.net/photo.jpg")
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
