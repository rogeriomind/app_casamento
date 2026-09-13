import { notFound, redirect } from "next/navigation";
import { EventState } from "@/generated/prisma/client";
import { CreatedAlbum } from "@/features/events/components/event-wizard";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function EventCreatedPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser(); const { id } = await params;
  const event = await prisma.event.findFirst({ where: { id, ownerId: user.id } });
  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");
  return <CreatedAlbum event={event} />;
}
