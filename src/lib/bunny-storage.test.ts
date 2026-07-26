import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  BunnyStorageError,
  getBunnyObjectPathFromPublicUrl,
  getBunnyPublicUrl,
  normalizeBunnyObjectPath,
  deleteBunnyObject,
  uploadBunnyObject,
  type BunnyStorageConfig,
} from "@/lib/bunny-storage";

const config: BunnyStorageConfig = {
  storageEndpoint: "https://br.storage.bunnycdn.com/app-casamento-test/",
  storagePassword: "super-secret",
  publicBaseUrl: "https://app-casamento-test.b-cdn.net/",
};

describe("bunny storage helper", () => {
  it("builds public URLs without duplicated slashes", () => {
    expect(getBunnyPublicUrl("/clients/hash-123//photos/photo.jpg", config)).toBe(
      "https://app-casamento-test.b-cdn.net/clients/hash-123/photos/photo.jpg",
    );
  });

  it("extracts object paths from public Bunny URLs", () => {
    expect(
      getBunnyObjectPathFromPublicUrl(
        "https://app-casamento-test.b-cdn.net/clients/hash-123/photos/photo.jpg",
        config.publicBaseUrl,
      ),
    ).toBe("clients/hash-123/photos/photo.jpg");
    expect(
      getBunnyObjectPathFromPublicUrl(
        "https://example.com/clients/hash-123/photos/photo.jpg",
        config.publicBaseUrl,
      ),
    ).toBeNull();
  });

  it("keeps legacy upload object paths parseable", () => {
    expect(
      getBunnyObjectPathFromPublicUrl(
        "https://app-casamento-test.b-cdn.net/uploads/event-1/photo.jpg",
        config.publicBaseUrl,
      ),
    ).toBe("uploads/event-1/photo.jpg");
  });

  it("uploads files with the expected headers and checksum", async () => {
    const buffer = Buffer.from("hello");
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));

    const publicUrl = await uploadBunnyObject(
      "/clients/hash-123/photos/photo.jpg",
      buffer,
      { config, fetchFn: fetchMock as unknown as typeof fetch },
    );

    expect(publicUrl).toBe(
      "https://app-casamento-test.b-cdn.net/clients/hash-123/photos/photo.jpg",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://br.storage.bunnycdn.com/app-casamento-test/clients/hash-123/photos/photo.jpg",
    );
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect(init.headers).toMatchObject({
      AccessKey: "super-secret",
      "Content-Type": "application/octet-stream",
      Checksum: createHash("sha256")
        .update(buffer)
        .digest("hex")
        .toUpperCase(),
    });
  });

  it("rejects non-201 upload responses without exposing the access key", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    let error: unknown;

    try {
      await uploadBunnyObject(
        "clients/hash-123/photos/photo.jpg",
        Buffer.from("hello"),
        { config, fetchFn: fetchMock as unknown as typeof fetch },
      );
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(BunnyStorageError);
    expect(error).toMatchObject({
      code: "BUNNY_UPLOAD_FAILED",
      status: 401,
    });
    expect((error as Error).message).not.toContain("super-secret");
  });

  it("uploads files with explicit content type and immutable cache headers", async () => {
    const buffer = Buffer.from("webp");
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));

    await uploadBunnyObject("clients/hash-123/thumbnails/photo.webp", buffer, {
      config,
      fetchFn: fetchMock as unknown as typeof fetch,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.headers).toMatchObject({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });

  it("normalizes paths and blocks traversal", () => {
    expect(normalizeBunnyObjectPath("/clients/hash/photos/a b.jpg")).toBe(
      "clients/hash/photos/a%20b.jpg",
    );
    expect(() => normalizeBunnyObjectPath("clients/../secret.jpg")).toThrow(
      /invalido/,
    );
  });

  it("accepts deletion of an object that is already absent", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));

    await expect(
      deleteBunnyObject(
        "clients/hash-123/photos/missing.jpg",
        config,
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined();
  });
});
