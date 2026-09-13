import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    eventKey: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRESENCE_UPDATE_MIN_INTERVAL_MS = 45_000;

export async function POST(request: Request, context: RouteContext) {
  const { eventKey } = await context.params;
  const deviceId = request.headers.get("x-device-id")?.trim();

  if (!deviceId) {
    return jsonError("Identificador do aparelho nao informado.", 400, "MISSING_DEVICE_ID");
  }

  let body: { guestSessionId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Envie um JSON valido.", 400, "INVALID_JSON");
  }

  if (typeof body.guestSessionId !== "string" || body.guestSessionId.length === 0) {
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
      id: body.guestSessionId,
      eventId: event.id,
      deviceId,
    },
    select: {
      id: true,
      lastSeenAt: true,
    },
  });

  if (!guestSession) {
    return jsonError("Sessao do convidado invalida.", 403, "INVALID_SESSION");
  }

  const lastSeenAt = new Date();
  const updateThreshold = new Date(
    lastSeenAt.getTime() - PRESENCE_UPDATE_MIN_INTERVAL_MS,
  );

  if (guestSession.lastSeenAt > updateThreshold) {
    return NextResponse.json({
      ok: true,
      updated: false,
      lastSeenAt: guestSession.lastSeenAt.toISOString(),
    });
  }

  const updatedSessions = await prisma.guestSession.updateMany({
    where: {
      id: body.guestSessionId,
      eventId: event.id,
      deviceId,
      lastSeenAt: { lte: updateThreshold },
    },
    data: { lastSeenAt },
  });

  if (updatedSessions.count === 0) {
    return NextResponse.json({
      ok: true,
      updated: false,
      lastSeenAt: guestSession.lastSeenAt.toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    updated: true,
    lastSeenAt: lastSeenAt.toISOString(),
  });
}
