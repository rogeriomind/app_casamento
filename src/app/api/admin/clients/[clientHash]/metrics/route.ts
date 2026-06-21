import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    clientHash: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ONLINE_WINDOW_SECONDS = 120;

export async function GET(request: Request, context: RouteContext) {
  const authError = requireAdminRequest(request);
  if (authError) {
    return authError;
  }

  const { clientHash } = await context.params;
  const event = await prisma.event.findUnique({
    where: { clientHash },
    select: {
      id: true,
      clientHash: true,
      clientNumber: true,
    },
  });

  if (!event) {
    return jsonError("Cliente nao encontrado.", 404, "CLIENT_NOT_FOUND");
  }

  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000);
  const [publishedPhotos, totalPhotos, onlineUsers, enteredUsers] =
    await Promise.all([
      prisma.photo.count({
        where: { eventId: event.id, status: "published" },
      }),
      prisma.photo.count({
        where: { eventId: event.id },
      }),
      prisma.guestSession.count({
        where: {
          eventId: event.id,
          lastSeenAt: { gte: onlineSince },
          deviceId: { not: null },
        },
      }),
      prisma.guestSession.count({
        where: {
          eventId: event.id,
          deviceId: { not: null },
        },
      }),
    ]);

  return NextResponse.json({
    clientHash: event.clientHash,
    clientNumber: event.clientNumber,
    photos: {
      published: publishedPhotos,
      total: totalPhotos,
    },
    users: {
      online: onlineUsers,
      entered: enteredUsers,
    },
    onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
  });
}
