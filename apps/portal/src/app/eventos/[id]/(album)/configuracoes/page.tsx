import { notFound, redirect } from "next/navigation";
import { EventState } from "@/generated/prisma/client";
import { EventSettings } from "@/features/dashboard/components/event-settings";
import { getOwnedEvent } from "@/lib/owned-event";
import { requireVerifiedUser } from "@/lib/session";
import { colorValues } from "@/lib/event-constants";

export default async function EventSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const event = await getOwnedEvent(id, user.id);
  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");

  const albumColor = colorValues.includes(event.albumColor as (typeof colorValues)[number])
    ? event.albumColor as (typeof colorValues)[number]
    : colorValues[0];

  return <EventSettings event={{
    ...event,
    albumColor,
    eventDate: event.eventDate?.toISOString().slice(0, 10) ?? "",
    coverUrl: event.coverPath ? `/api/eventos/${event.id}/capa` : null,
    logoUrl: event.logoPath ? `/api/eventos/${event.id}/logo` : null,
  }} />;
}
