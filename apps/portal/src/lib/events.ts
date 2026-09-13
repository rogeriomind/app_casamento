import "server-only";
import { type Event, type Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./api";

export async function getDraftForUser(ownerId: string) {
  return prisma.event.findFirst({ where: { ownerId, state: "DRAFT" }, orderBy: { updatedAt: "desc" } });
}
export async function getOrCreateDraftForUser(ownerId: string): Promise<Event> {
  return prisma.$transaction(async (tx) => {
    // Serialize the first draft across prefetches, tabs and repeated requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
    return await tx.event.findFirst({ where: { ownerId, state: "DRAFT" }, orderBy: { updatedAt: "desc" } })
      ?? tx.event.create({ data: { ownerId } });
  });
}
export function withOwnedEvent<T>(id: string, ownerId: string, action: (tx: Prisma.TransactionClient, event: Event) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
    const event = await tx.event.findFirst({ where: { id, ownerId } });
    if (!event) throw new HttpError(404, "Evento não encontrado.");
    return action(tx, event);
  });
}
export function draftDestination(event: Event | null) {
  if (!event || !event.type) return "/eventos/novo/tipo";
  if (!event.name?.trim() || !event.eventDate) return "/eventos/novo/informacoes";
  return "/eventos/novo/personalizacao";
}
