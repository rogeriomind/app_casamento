import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  BunnyStreamError,
  createBunnyStreamVideo,
  createBunnyTusSignature,
  getBunnyStreamThumbnailUrl,
  verifyBunnyStreamWebhookSignature,
  type BunnyStreamConfig,
} from "@/lib/bunny-stream";

const config: BunnyStreamConfig = {
  libraryId: "123456",
  apiKey: "stream-secret",
  pullZoneHostname: "vz-example.b-cdn.net",
  webhookSecret: "webhook-secret",
  requestTimeoutMs: 1000,
};

describe("bunny stream helper", () => {
  it("creates TUS signatures without exposing the API key", () => {
    const signature = createBunnyTusSignature("video-guid", {
      config,
      expiresAt: 1800000000,
    });

    expect(signature).toMatchObject({
      endpoint: "https://video.bunnycdn.com/tusupload",
      libraryId: "123456",
      videoId: "video-guid",
      authorizationExpire: 1800000000,
    });
    expect(signature.authorizationSignature).toBe(
      createHash("sha256")
        .update("123456stream-secret1800000000video-guid")
        .digest("hex"),
    );
    expect(JSON.stringify(signature)).not.toContain("stream-secret");
  });

  it("validates Bunny webhook signatures over the raw body", () => {
    const rawBody = Buffer.from(
      JSON.stringify({ VideoLibraryId: 123456, VideoGuid: "video-guid", Status: 3 }),
    );
    const signature = createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");

    expect(
      verifyBunnyStreamWebhookSignature(
        rawBody,
        {
          signature,
          version: "v1",
          algorithm: "hmac-sha256",
        },
        config,
      ),
    ).toBe(true);
    expect(
      verifyBunnyStreamWebhookSignature(
        Buffer.from("{}"),
        {
          signature,
          version: "v1",
          algorithm: "hmac-sha256",
        },
        config,
      ),
    ).toBe(false);
  });

  it("creates videos using the library access key only on the server request", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            videoLibraryId: 123456,
            guid: "video-guid",
            title: "video.mov",
            status: 0,
          }),
          { status: 200 },
        ),
    );

    const video = await createBunnyStreamVideo(
      { title: "video.mov", thumbnailTime: 1000 },
      { config, fetchFn: fetchMock as unknown as typeof fetch },
    );

    expect(video.guid).toBe("video-guid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://video.bunnycdn.com/library/123456/videos",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          AccessKey: "stream-secret",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("rejects failed responses without leaking secrets", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 401 }));
    let error: unknown;

    try {
      await createBunnyStreamVideo(
        { title: "video.mov" },
        { config, fetchFn: fetchMock as unknown as typeof fetch },
      );
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(BunnyStreamError);
    expect(error).toMatchObject({
      code: "BUNNY_STREAM_REQUEST_FAILED",
      status: 401,
    });
    expect((error as Error).message).not.toContain("stream-secret");
  });

  it("builds thumbnail URLs from the pull zone hostname", () => {
    expect(getBunnyStreamThumbnailUrl("video-guid", config)).toBe(
      "https://vz-example.b-cdn.net/video-guid/thumbnail.jpg",
    );
  });
});
