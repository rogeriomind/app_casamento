import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  guestSession: {
    findFirst: vi.fn(),
  },
  photo: {
    create: vi.fn(),
  },
}));

const bunnyStreamMock = vi.hoisted(() => {
  class BunnyStreamError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status?: number,
    ) {
      super(message);
      this.name = "BunnyStreamError";
    }
  }

  return {
    BunnyStreamError,
    getBunnyStreamConfig: vi.fn(),
    createBunnyStreamVideo: vi.fn(),
    createBunnyTusSignature: vi.fn(),
    deleteBunnyStreamVideo: vi.fn(),
    getBunnyStreamEmbedUrl: vi.fn(),
    getBunnyStreamPlaybackUrl: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/bunny-stream", () => bunnyStreamMock);

import { POST } from "./route";

const context = {
  params: Promise.resolve({ eventKey: "event-1" }),
};

function request(body: unknown) {
  return new Request("http://localhost/api/events/event-1/videos/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/events/[eventKey]/videos/init", () => {
  beforeEach(() => {
    prismaMock.event.findUnique.mockReset();
    prismaMock.guestSession.findFirst.mockReset();
    prismaMock.photo.create.mockReset();
    bunnyStreamMock.getBunnyStreamConfig.mockReset();
    bunnyStreamMock.createBunnyStreamVideo.mockReset();
    bunnyStreamMock.createBunnyTusSignature.mockReset();
    bunnyStreamMock.deleteBunnyStreamVideo.mockReset();
    bunnyStreamMock.getBunnyStreamEmbedUrl.mockReset();
    bunnyStreamMock.getBunnyStreamPlaybackUrl.mockReset();

    bunnyStreamMock.getBunnyStreamConfig.mockReturnValue({
      libraryId: "123456",
      apiKey: "stream-secret",
      pullZoneHostname: "vz-example.b-cdn.net",
      webhookSecret: "webhook-secret",
    });
    bunnyStreamMock.createBunnyStreamVideo.mockResolvedValue({
      guid: "video-guid",
    });
    bunnyStreamMock.createBunnyTusSignature.mockReturnValue({
      endpoint: "https://video.bunnycdn.com/tusupload",
      libraryId: "123456",
      videoId: "video-guid",
      authorizationExpire: 1800000000,
      authorizationSignature: "signed",
    });
    bunnyStreamMock.getBunnyStreamEmbedUrl.mockReturnValue(
      "https://player.mediadelivery.net/embed/123456/video-guid",
    );
    bunnyStreamMock.getBunnyStreamPlaybackUrl.mockReturnValue(
      "https://player.mediadelivery.net/play/123456/video-guid",
    );
  });

  it("creates a Bunny Stream video and a hidden uploading media record", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      guestName: "Maria",
    });
    prismaMock.photo.create.mockResolvedValueOnce({
      id: "photo-video-1",
      status: "uploading",
      streamVideoId: "video-guid",
    });

    const response = await POST(
      request({
        guestSessionId: "session-1",
        fileName: "cerimonia.mp4",
        mimeType: "video/mp4",
        sizeInBytes: 1024,
        durationSeconds: 42.2,
        tags: ["cerimonia"],
      }),
      context,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(bunnyStreamMock.createBunnyStreamVideo).toHaveBeenCalledWith(
      { title: "event-1 - cerimonia.mp4" },
      expect.objectContaining({
        config: expect.objectContaining({ libraryId: "123456" }),
      }),
    );
    expect(prismaMock.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mediaType: "video",
        status: "uploading",
        imageUrl: null,
        streamVideoId: "video-guid",
        streamLibraryId: "123456",
        durationSeconds: 43,
        tags: JSON.stringify(["cerimonia"]),
      }),
      select: {
        id: true,
        status: true,
        streamVideoId: true,
      },
    });
    expect(data).toMatchObject({
      photoId: "photo-video-1",
      status: "uploading",
      tus: {
        endpoint: "https://video.bunnycdn.com/tusupload",
        headers: {
          AuthorizationSignature: "signed",
          AuthorizationExpire: "1800000000",
          LibraryId: "123456",
          VideoId: "video-guid",
        },
        metadata: {
          filetype: "video/mp4",
          title: "event-1 - cerimonia.mp4",
          thumbnailTime: "1000",
        },
      },
    });
    expect(JSON.stringify(data)).not.toContain("stream-secret");
  });

  it("returns a safe error when Bunny Stream is not configured", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      guestName: "Maria",
    });
    bunnyStreamMock.getBunnyStreamConfig.mockImplementationOnce(() => {
      throw new bunnyStreamMock.BunnyStreamError(
        "Bunny Stream nao esta configurado.",
        "BUNNY_STREAM_NOT_CONFIGURED",
      );
    });

    const response = await POST(
      request({
        guestSessionId: "session-1",
        fileName: "cerimonia.mp4",
        mimeType: "video/mp4",
        sizeInBytes: 1024,
        durationSeconds: 42,
      }),
      context,
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      code: "BUNNY_STREAM_NOT_CONFIGURED",
      error: "Envio de video nao configurado.",
    });
    expect(bunnyStreamMock.createBunnyStreamVideo).not.toHaveBeenCalled();
    expect(JSON.stringify(data)).not.toContain("stream-secret");
  });

  it("rejects unsupported video types before creating a Bunny video", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      guestName: "Maria",
    });

    const response = await POST(
      request({
        guestSessionId: "session-1",
        fileName: "arquivo.pdf",
        mimeType: "application/pdf",
        sizeInBytes: 1024,
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(bunnyStreamMock.createBunnyStreamVideo).not.toHaveBeenCalled();
  });

  it("rejects invalid guest sessions before creating a Bunny video", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce(null);

    const response = await POST(
      request({
        guestSessionId: "session-missing",
        fileName: "cerimonia.mp4",
        mimeType: "video/mp4",
        sizeInBytes: 1024,
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(bunnyStreamMock.createBunnyStreamVideo).not.toHaveBeenCalled();
  });

  it("rejects videos over 100 MB before creating a Bunny video", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      guestName: "Maria",
    });

    const response = await POST(
      request({
        guestSessionId: "session-1",
        fileName: "cerimonia.mp4",
        mimeType: "video/mp4",
        sizeInBytes: 101 * 1024 * 1024,
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(bunnyStreamMock.createBunnyStreamVideo).not.toHaveBeenCalled();
  });
});
