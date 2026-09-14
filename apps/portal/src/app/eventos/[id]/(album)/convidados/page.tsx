import { notFound, redirect } from "next/navigation";
import { EventState } from "@/generated/prisma/client";
import { GuestsDashboard } from "@/features/dashboard/components/guests-dashboard";
import { buildParticipations, normalizeParticipationName } from "@/features/dashboard/lib/participations";
import { getOwnedEvent } from "@/lib/owned-event";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

type SearchParams = Promise<{ busca?: string; tipo?: string; ordem?: string; pagina?: string }>;

const pageSize = 10;

export default async function GuestsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await requireVerifiedUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const event = await getOwnedEvent(id, user.id);
  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");

  const [media, captureIntegration] = await Promise.all([
    prisma.photo.findMany({
      where: { eventId: event.id, isVisible: true },
      select: { authorName: true, mediaType: true, tags: true, likeCount: true, createdAt: true },
    }),
    prisma.captureIntegration.findUnique({ where: { eventId: event.id }, select: { lastSyncAt: true, lastError: true, remoteGuestSessions: true } }),
  ]);

  const allParticipations = buildParticipations(media);
  const type = query.tipo === "fotos" || query.tipo === "videos" ? query.tipo : "todos";
  const order = query.ordem === "midias" || query.ordem === "curtidas" ? query.ordem : "recentes";
  const search = query.busca?.trim().slice(0, 120) ?? "";
  const needle = normalizeParticipationName(search);
  const filtered = allParticipations.filter((item) => {
    if (type === "fotos" && item.photoCount === 0) return false;
    if (type === "videos" && item.videoCount === 0) return false;
    return !needle || normalizeParticipationName(item.name).includes(needle) || item.tags.some((tag) => normalizeParticipationName(tag).includes(needle));
  });
  filtered.sort((left, right) => order === "midias"
    ? right.mediaCount - left.mediaCount || left.name.localeCompare(right.name, "pt-BR")
    : order === "curtidas"
      ? right.likeCount - left.likeCount || left.name.localeCompare(right.name, "pt-BR")
      : new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime() || left.name.localeCompare(right.name, "pt-BR"));
  const requestedPage = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleParticipations = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <GuestsDashboard
    event={{ id: event.id, name: event.name, coverPath: event.coverPath }}
    metrics={{
      identifiedNames: allParticipations.length,
      mediaCount: media.length,
      guestSessions: captureIntegration?.remoteGuestSessions ?? null,
      likes: media.reduce((total, item) => total + item.likeCount, 0),
      withPhotos: allParticipations.filter((item) => item.photoCount > 0).length,
      withVideos: allParticipations.filter((item) => item.videoCount > 0).length,
    }}
    participations={visibleParticipations}
    filteredCount={filtered.length}
    filters={{ search, type, order, page, totalPages }}
    capture={captureIntegration ? { lastSyncAt: captureIntegration.lastSyncAt?.toISOString() ?? null, lastError: captureIntegration.lastError } : null}
  />;
}
