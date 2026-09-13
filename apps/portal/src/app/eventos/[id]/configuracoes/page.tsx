import { notFound, redirect } from "next/navigation";
import { EventState } from "@/generated/prisma/client";
import { EventSettings } from "@/features/dashboard/components/event-settings";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";
import { colorValues } from "@/lib/validation";

export default async function EventSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, ownerId: user.id },
    select: {
      id: true, type: true, name: true, eventDate: true, displayNames: true, eventTime: true, venue: true,
      albumColor: true, albumStyle: true, welcomeMessage: true, coverPath: true, logoPath: true, state: true,
    },
  });
  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");

  const albumColor = colorValues.includes(event.albumColor as (typeof colorValues)[number])
    ? event.albumColor as (typeof colorValues)[number]
    : colorValues[0];

  return <EventSettings user={{ name: user.name }} event={{
    ...event,
    albumColor,
    eventDate: event.eventDate?.toISOString().slice(0, 10) ?? "",
    coverUrl: event.coverPath ? `/api/eventos/${event.id}/capa` : null,
    logoUrl: event.logoPath ? `/api/eventos/${event.id}/logo` : null,
  }} />;
}
