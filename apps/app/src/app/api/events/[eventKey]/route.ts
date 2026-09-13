import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { serializeEvent } from "@/lib/serializers";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    eventKey: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { eventKey } = await context.params;

  const event = await prisma.event.findFirst({
    where: {
      OR: [{ clientHash: eventKey }, { slug: eventKey }],
    },
  });

  if (!event) {
    return jsonError("Evento não encontrado.", 404, "EVENT_NOT_FOUND");
  }

  if (!event.isActive) {
    return jsonError("Este evento não está disponível.", 403, "EVENT_INACTIVE");
  }

  return NextResponse.json(serializeEvent(event));
}
