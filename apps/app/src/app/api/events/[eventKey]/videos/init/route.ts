import { NextResponse } from "next/server";
import {
  BunnyStreamError,
  type BunnyStreamConfig,
  createBunnyStreamVideo,
  createBunnyTusSignature,
  deleteBunnyStreamVideo,
  getBunnyStreamConfig,
  getBunnyStreamEmbedUrl,
  getBunnyStreamPlaybackUrl,
} from "@/lib/bunny-stream";
import { jsonError } from "@/lib/api";
import { normalizePhotoTags, parsePhotoTagsInput } from "@/lib/photo-tags";
import { prisma } from "@/lib/prisma";
import { validateVideoFileInput } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    eventKey: string;
  }>;
};

type InitVideoPayload = {
  guestSessionId?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  sizeInBytes?: unknown;
  durationSeconds?: unknown;
  tags?: unknown;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readPayloadNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getSafeVideoTitle(fileName: string, eventId: string) {
  const safeName = fileName.trim().replace(/\s+/g, " ").slice(0, 120);
  return safeName ? `${eventId} - ${safeName}` : `${eventId} - video`;
}

export async function POST(request: Request, context: RouteContext) {
  const { eventKey } = await context.params;

  let payload: InitVideoPayload;
  try {
    payload = (await request.json()) as InitVideoPayload;
  } catch {
    return jsonError("Envie os dados do video em JSON.", 400, "INVALID_JSON");
  }

  if (typeof payload.guestSessionId !== "string") {
    return jsonError("Sessao do convidado nao informada.", 400, "MISSING_SESSION");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventKey },
    select: { id: true, isActive: true },
  });

  if (!event || !event.isActive) {
    return jsonError("Evento indisponivel.", 404, "EVENT_UNAVAILABLE");
  }

  const guestSession = await prisma.guestSession.findFirst({
    where: {
      id: payload.guestSessionId,
      eventId: event.id,
    },
    select: { id: true, guestName: true },
  });

  if (!guestSession) {
    return jsonError("Sessao do convidado invalida.", 403, "INVALID_SESSION");
  }

  const fileName =
    typeof payload.fileName === "string" ? payload.fileName : "video";
  const mimeType =
    typeof payload.mimeType === "string" ? payload.mimeType : "";
  const sizeInBytes = readPayloadNumber(payload.sizeInBytes);
  const durationSeconds = readPayloadNumber(payload.durationSeconds);

  if (typeof sizeInBytes !== "number" || !Number.isInteger(sizeInBytes)) {
    return jsonError("Tamanho do video invalido.", 400, "INVALID_VIDEO_SIZE");
  }
  const normalizedDurationSeconds =
    typeof durationSeconds === "number" ? Math.ceil(durationSeconds) : null;

  const validation = validateVideoFileInput({
    name: fileName,
    type: mimeType,
    size: sizeInBytes,
    durationSeconds: normalizedDurationSeconds,
  });

  if (!validation.ok) {
    return jsonError(validation.message, 400, validation.code);
  }

  const tags = Array.isArray(payload.tags)
    ? normalizePhotoTags(
        payload.tags.filter((tag): tag is string => typeof tag === "string"),
      )
    : parsePhotoTagsInput(typeof payload.tags === "string" ? payload.tags : null);
  const title = getSafeVideoTitle(fileName, event.id);
  let config: BunnyStreamConfig | null = null;
  let streamVideoId: string | null = null;

  try {
    config = getBunnyStreamConfig();
    const streamVideo = await createBunnyStreamVideo(
      { title },
      { config },
    );
    streamVideoId = streamVideo.guid;

    const videoEmbedUrl = getBunnyStreamEmbedUrl(streamVideo.guid, config, {
      autoplay: false,
      preload: true,
      responsive: true,
    });
    const playbackUrl = getBunnyStreamPlaybackUrl(streamVideo.guid, config);
    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        guestSessionId: guestSession.id,
        guestName: guestSession.guestName,
        mediaType: "video",
        imageUrl: null,
        thumbnailUrl: null,
        status: "uploading",
        streamVideoId: streamVideo.guid,
        streamLibraryId: config.libraryId,
        videoEmbedUrl,
        playbackUrl,
        durationSeconds: normalizedDurationSeconds,
        width: null,
        height: null,
        originalFileName: fileName || null,
        mimeType,
        sizeInBytes,
        tags: JSON.stringify(tags),
      },
      select: {
        id: true,
        status: true,
        streamVideoId: true,
      },
    });
    const tus = createBunnyTusSignature(streamVideo.guid, { config });

    console.info("video_upload_initialized", {
      eventId: event.id,
      photoId: photo.id,
      guestSessionId: guestSession.id,
      streamVideoId: streamVideo.guid,
    });

    return NextResponse.json(
      {
        photoId: photo.id,
        status: photo.status,
        streamVideoId: photo.streamVideoId,
        tus: {
          endpoint: tus.endpoint,
          headers: {
            AuthorizationSignature: tus.authorizationSignature,
            AuthorizationExpire: String(tus.authorizationExpire),
            LibraryId: tus.libraryId,
            VideoId: tus.videoId,
          },
          metadata: {
            filetype: mimeType,
            title,
            thumbnailTime: "1000",
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (streamVideoId && config) {
      await deleteBunnyStreamVideo(streamVideoId, { config }).catch(() => undefined);
    }

    if (error instanceof BunnyStreamError) {
      console.warn("video_upload_init_stream_failed", {
        eventId: event.id,
        guestSessionId: guestSession.id,
        code: error.code,
        status: error.status,
      });
      if (error.code === "BUNNY_STREAM_NOT_CONFIGURED") {
        return jsonError(
          "Envio de video nao configurado.",
          500,
          "BUNNY_STREAM_NOT_CONFIGURED",
        );
      }

      return jsonError(
        "Nao foi possivel iniciar o envio do video agora.",
        502,
        "BUNNY_STREAM_INIT_FAILED",
      );
    }

    console.error("video_upload_init_failed", {
      eventId: event.id,
      guestSessionId: guestSession.id,
      error,
    });
    return jsonError(
      "Nao foi possivel iniciar o envio do video agora.",
      500,
      "VIDEO_INIT_FAILED",
    );
  }
}
