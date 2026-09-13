import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";

export const getOwnedEvent = cache((id: string, ownerId: string) =>
  prisma.event.findFirst({ where: { id, ownerId } }),
);
