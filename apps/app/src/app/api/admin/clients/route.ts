import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/admin-auth";
import {
  buildClientMetricsUrl,
  buildClientPublicUrl,
  createClientHash,
  createClientStoragePrefix,
} from "@/lib/client-identity";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  albumNameSchema,
  clientNameSchema,
  clientNumberSchema,
  coupleNameSchema,
  monogramSchema,
} from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createClientSchema = z.object({
  clientName: clientNameSchema,
  clientNumber: clientNumberSchema,
  coupleName: coupleNameSchema,
  eventDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Data do evento invalida.",
    })
    .transform((value) => new Date(value)),
  albumName: albumNameSchema,
  monogram: monogramSchema,
  isActive: z.boolean().optional().default(true),
});

function serializeAdminClient(event: {
  id: string;
  clientHash: string;
  clientNumber: string;
  storagePrefix: string;
}) {
  return {
    id: event.id,
    clientHash: event.clientHash,
    clientNumber: event.clientNumber,
    publicUrl: buildClientPublicUrl(event.clientHash),
    metricsUrl: buildClientMetricsUrl(event.clientHash),
    storagePrefix: event.storagePrefix,
  };
}

export async function POST(request: Request) {
  const authError = requireAdminRequest(request);
  if (authError) {
    return authError;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Envie um JSON valido.", 400, "INVALID_JSON");
  }

  const result = createClientSchema.safeParse(body);
  if (!result.success) {
    return jsonError(
      result.error.issues[0]?.message ?? "Dados do cliente invalidos.",
      400,
      "INVALID_CLIENT_DATA",
    );
  }

  const data = result.data;
  const existing = await prisma.event.findUnique({
    where: { clientNumber: data.clientNumber },
    select: {
      id: true,
      clientHash: true,
      clientNumber: true,
      storagePrefix: true,
    },
  });

  if (existing) {
    return NextResponse.json(serializeAdminClient(existing));
  }

  const clientHash = createClientHash(data.clientName, data.clientNumber);
  const hashOwner = await prisma.event.findUnique({
    where: { clientHash },
    select: { id: true },
  });

  if (hashOwner) {
    return jsonError("Hash do cliente ja existe.", 409, "CLIENT_HASH_COLLISION");
  }

  const storagePrefix = createClientStoragePrefix(clientHash);
  const event = await prisma.event.create({
    data: {
      slug: clientHash,
      clientName: data.clientName,
      clientNumber: data.clientNumber,
      clientHash,
      storagePrefix,
      name: data.albumName,
      coupleName: data.coupleName,
      monogram: data.monogram,
      eventDate: data.eventDate,
      isActive: data.isActive,
    },
    select: {
      id: true,
      clientHash: true,
      clientNumber: true,
      storagePrefix: true,
    },
  });

  return NextResponse.json(serializeAdminClient(event), { status: 201 });
}
