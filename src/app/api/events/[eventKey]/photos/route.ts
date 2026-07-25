import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  buildGalleryCursorWhere,
  decodeGalleryCursor,
  encodeGalleryCursor,
  normalizeGalleryLimit,
} from "@/lib/gallery-pagination";
import { parsePhotoTagsInput } from "@/lib/photo-tags";
import { prisma } from "@/lib/prisma";
import { processAndStorePhoto, UploadValidationError } from "@/lib/photo-storage";
import { serializePhoto } from "@/lib/serializers";
import { normalizeGuestName } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    eventKey: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeNameForOwnership(value: string) {
  return normalizeGuestName(value).toLocaleLowerCase("pt-BR");
}

export async function GET(request: Request, context: RouteContext) {
  const { eventKey } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = normalizeGalleryLimit(searchParams.get("limit"));
  const cursor = decodeGalleryCursor(searchParams.get("cursor"));
  const guestSessionId = searchParams.get("guestSessionId");

  const event = await prisma.event.findUnique({
    where: { id: eventKey },
    select: { id: true, isActive: true },
  });

  if (!event || !event.isActive) {
    return jsonError("Evento indisponível.", 404, "EVENT_UNAVAILABLE");
  }

  const photos = await prisma.photo.findMany({
    where: {
      eventId: event.id,
      status: "published",
      ...buildGalleryCursorWhere(cursor),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  let likedPhotoIds = new Set<string>();
  let currentGuestName: string | null = null;

  if (guestSessionId) {
    const guestSession = await prisma.guestSession.findFirst({
      where: {
        id: guestSessionId,
        eventId: event.id,
      },
      select: { id: true, guestName: true },
    });

    if (guestSession) {
      currentGuestName = normalizeNameForOwnership(guestSession.guestName);
      const likes = await prisma.photoLike.findMany({
        where: {
          guestSessionId: guestSession.id,
          photoId: {
            in: photos.slice(0, limit).map((photo) => photo.id),
          },
        },
        select: { photoId: true },
      });
      likedPhotoIds = new Set(likes.map((like) => like.photoId));
    }
  }

  const items = photos
    .slice(0, limit)
    .map((photo) =>
      serializePhoto(
        photo,
        likedPhotoIds.has(photo.id),
        normalizeNameForOwnership(photo.guestName) === currentGuestName,
        { preferObjectPathUrls: true },
      ),
    );
  const lastPhoto = items.length > 0 ? photos[items.length - 1] : null;

  return NextResponse.json({
    items,
    page: 1,
    limit,
    hasNextPage: photos.length > limit,
    nextCursor:
      photos.length > limit && lastPhoto ? encodeGalleryCursor(lastPhoto) : null,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { eventKey } = await context.params;

  const event = await prisma.event.findUnique({
    where: { id: eventKey },
    select: { id: true, isActive: true, storagePrefix: true },
  });

  if (!event || !event.isActive) {
    return jsonError("Evento indisponível.", 404, "EVENT_UNAVAILABLE");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Envie a foto usando multipart/form-data.", 400, "INVALID_FORM");
  }

  const guestSessionId = formData.get("guestSessionId");
  const file = formData.get("file");
  const tags = parsePhotoTagsInput(formData.get("tags"));

  if (typeof guestSessionId !== "string" || guestSessionId.length === 0) {
    return jsonError("Sessão do convidado não informada.", 400, "MISSING_SESSION");
  }

  if (!(file instanceof File)) {
    return jsonError("Selecione uma foto para enviar.", 400, "MISSING_FILE");
  }

  const guestSession = await prisma.guestSession.findFirst({
    where: {
      id: guestSessionId,
      eventId: event.id,
    },
  });

  if (!guestSession) {
    return jsonError("Sessão do convidado inválida.", 403, "INVALID_SESSION");
  }

  try {
    const storedPhoto = await processAndStorePhoto(file, event.storagePrefix);
    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        guestSessionId: guestSession.id,
        guestName: guestSession.guestName,
        imageUrl: storedPhoto.imageUrl,
        thumbnailUrl: storedPhoto.thumbnailUrl,
        imageObjectPath: storedPhoto.imageObjectPath,
        thumbnailObjectPath: storedPhoto.thumbnailObjectPath,
        status: "published",
        originalFileName: storedPhoto.originalFileName,
        mimeType: storedPhoto.mimeType,
        sizeInBytes: storedPhoto.sizeInBytes,
        tags: JSON.stringify(tags),
      },
    });

    console.info("photo_upload_success", {
      eventId: event.id,
      photoId: photo.id,
      guestSessionId: guestSession.id,
    });

    return NextResponse.json(serializePhoto(photo, false, true), { status: 201 });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      console.warn("photo_upload_rejected", {
        eventId: event.id,
        guestSessionId: guestSession.id,
        code: error.code,
      });
      return jsonError(error.message, error.status, error.code);
    }

    console.error("photo_upload_failed", {
      eventId: event.id,
      guestSessionId: guestSession.id,
      error,
    });
    return jsonError(
      "Não foi possível enviar a foto agora. Tente novamente.",
      500,
      "UPLOAD_FAILED",
    );
  }
}
