import { notFound, redirect } from "next/navigation";
import { EventState } from "@/generated/prisma/client";
import { AlbumDashboard } from "@/features/dashboard/components/dashboard";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, ownerId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      state: true,
      albumColor: true,
      coverPath: true,
      displayNames: true,
      eventDate: true,
      venue: true,
    },
  });

  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");
  const visible = { eventId: event.id, isVisible: true };
  const [mediaCount, videoCount, likes, recentPhotos, integration] = await Promise.all([
    prisma.photo.count({ where: visible }),
    prisma.photo.count({ where: { ...visible, mediaType: "VIDEO" } }),
    prisma.photo.aggregate({ where: visible, _sum: { likeCount: true } }),
    prisma.photo.findMany({ where: { ...visible, mediaType: "IMAGE" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 8, select: { id: true, altText: true, collection: true, width: true, height: true, mediaType: true, tags: true, durationSeconds: true } }),
    prisma.captureIntegration.findUnique({ where: { eventId: event.id }, select: { lastSyncAt: true, lastError: true, remoteGuestSessions: true } }),
  ]);
  return <AlbumDashboard event={{ ...event, eventDate: event.eventDate?.toISOString() ?? null }} user={{ name: user.name }} metrics={{ mediaCount, videoCount, likes: likes._sum.likeCount ?? 0, guestSessions: integration?.remoteGuestSessions ?? 0 }} recentPhotos={recentPhotos} />;
}
