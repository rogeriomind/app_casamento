import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializePhoto } from "@/lib/serializers";
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

export async function POST(request: Request, context: RouteContext) {
  const { eventKey, photoId } = await context.params;

  let payload: { guestSessionId?: unknown; liked?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Envie os dados da curtida em JSON.", 400, "INVALID_JSON");
  }

  if (typeof payload.guestSessionId !== "string") {
    return jsonError("Sessao do convidado nao informada.", 400, "MISSING_SESSION");
  }

  if (typeof payload.liked !== "boolean") {
    return jsonError("Estado da curtida invalido.", 400, "INVALID_LIKE_STATE");
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
    select: { id: true },
  });

  if (!photo) {
    return jsonError("Foto nao encontrada.", 404, "PHOTO_NOT_FOUND");
  }

  const nextPhoto = await prisma.$transaction(async (tx) => {
    if (payload.liked) {
      const existingLike = await tx.photoLike.findFirst({
        where: {
          photoId: photo.id,
          guestSessionId: guestSession.id,
        },
        select: { id: true },
      });

      if (!existingLike) {
        await tx.photoLike.create({
          data: {
            photoId: photo.id,
            guestSessionId: guestSession.id,
          },
        });
        await tx.photo.update({
          where: { id: photo.id },
          data: { likeCount: { increment: 1 } },
        });
      }
    } else {
      const deletedLikes = await tx.photoLike.deleteMany({
        where: {
          photoId: photo.id,
          guestSessionId: guestSession.id,
        },
      });

      if (deletedLikes.count > 0) {
        await tx.photo.update({
          where: { id: photo.id },
          data: { likeCount: { decrement: 1 } },
        });
      }
    }

    const updatedPhoto = await tx.photo.findUniqueOrThrow({
      where: { id: photo.id },
    });
    const isLiked = payload.liked
      ? true
      : Boolean(
          await tx.photoLike.findFirst({
            where: {
              photoId: photo.id,
              guestSessionId: guestSession.id,
            },
            select: { id: true },
          }),
        );

    return serializePhoto(
      updatedPhoto,
      isLiked,
      normalizeNameForOwnership(updatedPhoto.guestName) ===
        normalizeNameForOwnership(guestSession.guestName),
    );
  });

  return NextResponse.json(nextPhoto);
}
