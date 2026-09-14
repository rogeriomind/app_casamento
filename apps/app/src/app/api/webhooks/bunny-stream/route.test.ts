import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  photo: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const bunnyMock = vi.hoisted(() => ({
  getBunnyStreamConfig: vi.fn(),
  getBunnyStreamVideo: vi.fn(),
  deleteBunnyStreamVideo: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/bunny-stream", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/bunny-stream")>(
      "@/lib/bunny-stream",
    );

  return {
    ...actual,
    getBunnyStreamConfig: bunnyMock.getBunnyStreamConfig,
    getBunnyStreamVideo: bunnyMock.getBunnyStreamVideo,
    deleteBunnyStreamVideo: bunnyMock.deleteBunnyStreamVideo,
  };
});

import { BUNNY_STREAM_STATUS } from "@/lib/bunny-stream";
import { POST } from "./route";

const config = {
  libraryId: "123456",
  apiKey: "stream-secret",
  pullZoneHostname: "vz-example.b-cdn.net",
  webhookSecret: "webhook-secret",
};

function signedRequest(payload: unknown, secret = config.webhookSecret) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  return new Request("http://localhost/api/webhooks/bunny-stream", {
    method: "POST",
    headers: {
      "x-bunnystream-signature": signature,
      "x-bunnystream-signature-version": "v1",
      "x-bunnystream-signature-algorithm": "hmac-sha256",
    },
    body,
  });
}

describe("POST /api/webhooks/bunny-stream", () => {
  beforeEach(() => {
    prismaMock.photo.findFirst.mockReset();
    prismaMock.photo.update.mockReset();
    prismaMock.photo.updateMany.mockReset();
    bunnyMock.getBunnyStreamConfig.mockReset();
    bunnyMock.getBunnyStreamVideo.mockReset();
    bunnyMock.deleteBunnyStreamVideo.mockReset();

    bunnyMock.getBunnyStreamConfig.mockReturnValue(config);
    bunnyMock.deleteBunnyStreamVideo.mockResolvedValue(undefined);
  });

  it("rejects invalid signatures before touching the database", async () => {
    const response = await POST(
      signedRequest(
        {
          VideoLibraryId: "123456",
          VideoGuid: "video-guid",
          Status: BUNNY_STREAM_STATUS.finished,
        },
        "wrong-secret",
      ),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.photo.findFirst).not.toHaveBeenCalled();
  });

  it("publishes a video only after Bunny reports finished processing", async () => {
    prismaMock.photo.findFirst.mockResolvedValueOnce({
      id: "photo-video-1",
      eventId: "event-1",
      status: "processing",
      streamVideoId: "video-guid",
    });
    bunnyMock.getBunnyStreamVideo.mockResolvedValueOnce({
      guid: "video-guid",
      videoLibraryId: "123456",
      title: "cerimonia.mp4",
      length: 42,
      status: BUNNY_STREAM_STATUS.finished,
      width: 1920,
      height: 1080,
      thumbnailFileName: "thumbnail.jpg",
      thumbnailUrl: null,
    });

    const response = await POST(
      signedRequest({
        VideoLibraryId: "123456",
        VideoGuid: "video-guid",
        Status: BUNNY_STREAM_STATUS.finished,
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.photo.update).toHaveBeenCalledWith({
      where: { id: "photo-video-1" },
      data: expect.objectContaining({
        status: "published",
        thumbnailUrl: "https://vz-example.b-cdn.net/video-guid/thumbnail.jpg",
        durationSeconds: 42,
        width: 1920,
        height: 1080,
        videoEmbedUrl:
          "https://player.mediadelivery.net/embed/123456/video-guid?autoplay=false&preload=true&responsive=true",
      }),
    });
  });

  it("keeps intermediate events hidden as processing", async () => {
    prismaMock.photo.findFirst.mockResolvedValueOnce({
      id: "photo-video-1",
      eventId: "event-1",
      status: "uploading",
      streamVideoId: "video-guid",
    });

    const response = await POST(
      signedRequest({
        VideoLibraryId: "123456",
        VideoGuid: "video-guid",
        Status: BUNNY_STREAM_STATUS.presignedUploadFinished,
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.photo.updateMany).toHaveBeenCalledWith({
      where: {
        id: "photo-video-1",
        status: { in: ["uploading", "processing"] },
      },
      data: { status: "processing" },
    });
    expect(prismaMock.photo.update).not.toHaveBeenCalled();
  });

  it("rejects and deletes videos longer than 60 seconds", async () => {
    prismaMock.photo.findFirst.mockResolvedValueOnce({
      id: "photo-video-1",
      eventId: "event-1",
      status: "processing",
      streamVideoId: "video-guid",
    });
    bunnyMock.getBunnyStreamVideo.mockResolvedValueOnce({
      guid: "video-guid",
      videoLibraryId: "123456",
      title: "cerimonia.mp4",
      length: 61,
      status: BUNNY_STREAM_STATUS.finished,
      width: 1920,
      height: 1080,
      thumbnailFileName: "thumbnail.jpg",
      thumbnailUrl: null,
    });

    const response = await POST(
      signedRequest({
        VideoLibraryId: "123456",
        VideoGuid: "video-guid",
        Status: BUNNY_STREAM_STATUS.finished,
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.photo.update).toHaveBeenCalledWith({
      where: { id: "photo-video-1" },
      data: expect.objectContaining({
        status: "rejected",
        durationSeconds: 61,
      }),
    });
    expect(bunnyMock.deleteBunnyStreamVideo).toHaveBeenCalledWith("video-guid", {
      config,
    });
  });
});
