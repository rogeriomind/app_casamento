import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  BunnyStorageError,
  getBunnyObjectPathFromPublicUrl,
  getBunnyPublicUrl,
  uploadBunnyObject,
  type BunnyStorageConfig,
} from "@/lib/bunny-storage";

const config: BunnyStorageConfig = {
  storageEndpoint: "https://br.storage.bunnycdn.com/productpulse/",
  storagePassword: "super-secret",
  publicBaseUrl: "https://productpulse.b-cdn.net/",
};

describe("bunny storage helper", () => {
  it("builds public URLs without duplicated slashes", () => {
    expect(getBunnyPublicUrl("/clients/hash-123//photos/photo.jpg", config)).toBe(
      "https://productpulse.b-cdn.net/clients/hash-123/photos/photo.jpg",
    );
  });

  it("extracts object paths from public Bunny URLs", () => {
    expect(
      getBunnyObjectPathFromPublicUrl(
        "https://productpulse.b-cdn.net/clients/hash-123/photos/photo.jpg",
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
        "https://productpulse.b-cdn.net/uploads/event-1/photo.jpg",
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
      config,
      fetchMock as unknown as typeof fetch,
    );

    expect(publicUrl).toBe(
      "https://productpulse.b-cdn.net/clients/hash-123/photos/photo.jpg",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://br.storage.bunnycdn.com/productpulse/clients/hash-123/photos/photo.jpg",
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
        config,
        fetchMock as unknown as typeof fetch,
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
});
