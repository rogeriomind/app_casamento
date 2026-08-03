import { NextResponse } from "next/server";
import {
  BUNNY_STREAM_STATUS,
  BunnyStreamError,
  deleteBunnyStreamVideo,
  getBunnyStreamConfig,
  getBunnyStreamEmbedUrl,
  getBunnyStreamPlaybackUrl,
  getBunnyStreamThumbnailUrl,
  getBunnyStreamVideo,
  verifyBunnyStreamWebhookSignature,
} from "@/lib/bunny-stream";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { MAX_VIDEO_DURATION_SECONDS } from "@/lib/validators";

type BunnyWebhookPayload = {
  VideoLibraryId: string;
  VideoGuid: string;
  Status: number;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseWebhookPayload(rawBody: Buffer): BunnyWebhookPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    return null;
  }

  const record = toRecord(parsed);
  const libraryId = record?.VideoLibraryId;
  const videoGuid = record?.VideoGuid;
  const status = record?.Status;

  if (
    (typeof libraryId !== "number" && typeof libraryId !== "string") ||
    typeof videoGuid !== "string" ||
    typeof status !== "number"
  ) {
    return null;
  }

  return {
    VideoLibraryId: String(libraryId),
    VideoGuid: videoGuid,
    Status: status,
  };
}

async function markVideoProcessing(photoId: string) {
  await prisma.photo.updateMany({
    where: {
      id: photoId,
      status: { in: ["uploading", "processing"] },
    },
    data: { status: "processing" },
  });
}

async function markVideoFailed(photoId: string) {
  await prisma.photo.updateMany({
    where: {
      id: photoId,
      status: { notIn: ["published", "rejected"] },
    },
    data: { status: "failed" },
  });
}

export async function POST(request: Request) {
  const config = getBunnyStreamConfig();
  const rawBody = Buffer.from(await request.arrayBuffer());
  const isValidSignature = verifyBunnyStreamWebhookSignature(
    rawBody,
    {
      signature: request.headers.get("x-bunnystream-signature"),
      version: request.headers.get("x-bunnystream-signature-version"),
      algorithm: request.headers.get("x-bunnystream-signature-algorithm"),
    },
    config,
  );

  if (!isValidSignature) {
    return jsonError("Assinatura invalida.", 401, "INVALID_SIGNATURE");
  }

  const payload = parseWebhookPayload(rawBody);
  if (!payload) {
    return jsonError("Payload Bunny Stream invalido.", 400, "INVALID_PAYLOAD");
  }

  const photo = await prisma.photo.findFirst({
    where: {
      mediaType: "video",
      streamLibraryId: payload.VideoLibraryId,
      streamVideoId: payload.VideoGuid,
    },
    select: {
      id: true,
      status: true,
      eventId: true,
      streamVideoId: true,
    },
  });

  if (!photo) {
    console.info("bunny_stream_webhook_unknown_video", {
      streamLibraryId: payload.VideoLibraryId,
      streamVideoId: payload.VideoGuid,
      status: payload.Status,
    });
    return NextResponse.json({ ok: true });
  }

  if (
    payload.Status === BUNNY_STREAM_STATUS.failed ||
    payload.Status === BUNNY_STREAM_STATUS.presignedUploadFailed
  ) {
    await markVideoFailed(photo.id);
    return NextResponse.json({ ok: true });
  }

  if (
    payload.Status === BUNNY_STREAM_STATUS.presignedUploadStarted ||
    payload.Status === BUNNY_STREAM_STATUS.presignedUploadFinished ||
    payload.Status === BUNNY_STREAM_STATUS.processing ||
    payload.Status === BUNNY_STREAM_STATUS.encoding ||
    payload.Status === BUNNY_STREAM_STATUS.resolutionFinished
  ) {
    await markVideoProcessing(photo.id);
    return NextResponse.json({ ok: true });
  }

  if (payload.Status !== BUNNY_STREAM_STATUS.finished) {
    return NextResponse.json({ ok: true });
  }

  try {
    const streamVideo = await getBunnyStreamVideo(payload.VideoGuid, { config });
    const durationSeconds = streamVideo.length ?? 0;

    if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: {
          status: "rejected",
          durationSeconds,
          width: streamVideo.width,
          height: streamVideo.height,
        },
      });
      await deleteBunnyStreamVideo(payload.VideoGuid, { config }).catch((error) => {
        console.warn("bunny_stream_rejected_video_cleanup_failed", {
          eventId: photo.eventId,
          photoId: photo.id,
          streamVideoId: payload.VideoGuid,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      return NextResponse.json({ ok: true });
    }

    const thumbnailUrl =
      streamVideo.thumbnailUrl ??
      getBunnyStreamThumbnailUrl(
        payload.VideoGuid,
        config,
        streamVideo.thumbnailFileName ?? undefined,
      );

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        status: "published",
        thumbnailUrl,
        durationSeconds,
        width: streamVideo.width,
        height: streamVideo.height,
        videoEmbedUrl: getBunnyStreamEmbedUrl(payload.VideoGuid, config, {
          autoplay: false,
          preload: true,
          responsive: true,
        }),
        playbackUrl: getBunnyStreamPlaybackUrl(payload.VideoGuid, config),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BunnyStreamError) {
      console.warn("bunny_stream_webhook_fetch_failed", {
        eventId: photo.eventId,
        photoId: photo.id,
        streamVideoId: payload.VideoGuid,
        code: error.code,
        status: error.status,
      });
    }

    return jsonError(
      "Nao foi possivel processar o webhook Bunny Stream.",
      502,
      "BUNNY_STREAM_WEBHOOK_FAILED",
    );
  }
}
