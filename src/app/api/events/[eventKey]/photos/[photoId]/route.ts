import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  deleteBunnyObject,
  getBunnyObjectPathFromPublicUrl,
} from "@/lib/bunny-storage";
import { prisma } from "@/lib/prisma";
import { normalizeGuestName } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    eventKey: string;
    photoId: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeNameForOwnership(value: string) {
  return normalizeGuestName(value).toLocaleLowerCase("pt-BR");
}

export async function DELETE(request: Request, context: RouteContext) {
  const { eventKey, photoId } = await context.params;

  let payload: { guestSessionId?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Envie os dados da exclusao em JSON.", 400, "INVALID_JSON");
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

  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      eventId: event.id,
      status: "published",
    },
    select: {
      id: true,
      guestName: true,
      imageUrl: true,
      thumbnailUrl: true,
      imageObjectPath: true,
      thumbnailObjectPath: true,
    },
  });

  if (
    !photo ||
    normalizeNameForOwnership(photo.guestName) !==
      normalizeNameForOwnership(guestSession.guestName)
  ) {
    return jsonError("Foto nao encontrada.", 404, "PHOTO_NOT_FOUND");
  }

  await prisma.photo.delete({
    where: { id: photo.id },
  });

  const bunnyObjectPaths = Array.from(
    new Set(
      [
        photo.imageObjectPath,
        photo.thumbnailObjectPath,
        getBunnyObjectPathFromPublicUrl(photo.imageUrl),
        photo.thumbnailUrl ? getBunnyObjectPathFromPublicUrl(photo.thumbnailUrl) : null,
      ]
        .filter((path): path is string => Boolean(path)),
    ),
  );

  const cleanupResults = await Promise.allSettled(
    bunnyObjectPaths.map((objectPath) => deleteBunnyObject(objectPath)),
  );
  const failedCleanupCount = cleanupResults.filter(
    (result) => result.status === "rejected",
  ).length;

  if (failedCleanupCount > 0) {
    console.warn("photo_delete_bunny_cleanup_failed", {
      eventId: event.id,
      photoId: photo.id,
      failedCleanupCount,
    });
  }

  return NextResponse.json({ ok: true });
}
