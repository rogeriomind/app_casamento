import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { guestNameSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    eventKey: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  const { eventKey } = await context.params;
  const event = await prisma.event.findUnique({
    where: { id: eventKey },
  });

  if (!event || !event.isActive) {
    return jsonError("Evento indisponível.", 404, "EVENT_UNAVAILABLE");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Envie um JSON válido.", 400, "INVALID_JSON");
  }

  const guestNameResult = guestNameSchema.safeParse(
    typeof body === "object" && body !== null && "guestName" in body
      ? body.guestName
      : "",
  );

  if (!guestNameResult.success) {
    return jsonError(
      guestNameResult.error.issues[0]?.message ?? "Nome inválido.",
      400,
      "INVALID_GUEST_NAME",
    );
  }

  const deviceId = request.headers.get("x-device-id")?.trim();
  if (!deviceId) {
    return jsonError("Identificador do aparelho nao informado.", 400, "MISSING_DEVICE_ID");
  }

  const session = await prisma.guestSession.upsert({
    where: {
      eventId_deviceId: {
        eventId: event.id,
        deviceId,
      },
    },
    update: {
      guestName: guestNameResult.data,
      lastSeenAt: new Date(),
    },
    create: {
      eventId: event.id,
      guestName: guestNameResult.data,
      deviceId,
    },
  });

  return NextResponse.json(
    {
      guestSessionId: session.id,
      guestName: session.guestName,
    },
    { status: 201 },
  );
}
