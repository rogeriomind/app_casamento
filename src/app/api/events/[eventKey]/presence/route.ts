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

  const lastSeenAt = new Date();
  const updatedSessions = await prisma.guestSession.updateMany({
    where: {
      id: body.guestSessionId,
      eventId: event.id,
      deviceId,
    },
    data: { lastSeenAt },
  });

  if (updatedSessions.count === 0) {
    return jsonError("Sessao do convidado invalida.", 403, "INVALID_SESSION");
  }

  return NextResponse.json({
    ok: true,
    lastSeenAt: lastSeenAt.toISOString(),
  });
}
