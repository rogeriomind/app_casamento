import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ clientHash: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  const authError = requireAdminRequest(request);
  if (authError) return authError;

  const { clientHash } = await context.params;
  const event = await prisma.event.findUnique({
    where: { clientHash },
    select: { id: true, clientHash: true, storagePrefix: true, isActive: true },
  });
  if (!event) return jsonError("Cliente nao encontrado.", 404, "CLIENT_NOT_FOUND");

  return NextResponse.json(event);
}
