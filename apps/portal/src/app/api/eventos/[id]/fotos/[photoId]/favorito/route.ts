import { NextResponse } from "next/server";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; photoId: string }> };

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const trusted = new Set([
    new URL(process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000").origin,
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]);
  if (!origin || !trusted.has(origin)) {
    throw new HttpError(403, "Origem da solicitação inválida.");
  }
}

async function ownedVisiblePhoto(userId: string, eventId: string, photoId: string) {
  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      eventId,
      isVisible: true,
      event: { ownerId: userId },
    },
    select: { id: true },
  });
  if (!photo) throw new HttpError(404, "Mídia não encontrada.");
  return photo;
}

export async function PUT(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    requireSameOrigin(request);
    const user = await apiUser();
    const { id, photoId } = await params;
    await ownedVisiblePhoto(user.id, id, photoId);
    await prisma.photoFavorite.upsert({
      where: { userId_photoId: { userId: user.id, photoId } },
      update: {},
      create: { userId: user.id, photoId },
    });
    return NextResponse.json({ favorited: true });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    requireSameOrigin(request);
    const user = await apiUser();
    const { id, photoId } = await params;
    await ownedVisiblePhoto(user.id, id, photoId);
    await prisma.photoFavorite.deleteMany({ where: { userId: user.id, photoId } });
    return NextResponse.json({ favorited: false });
  });
}
