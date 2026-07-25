import { EventUnavailable } from "@/components/event-unavailable";
import { WeddingAlbumApp } from "@/components/wedding-album-app";
import { DEFAULT_GALLERY_PAGE_SIZE } from "@/lib/gallery-pagination";
import { prisma } from "@/lib/prisma";
import { serializeEvent, serializePhoto } from "@/lib/serializers";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ clientHash: slug }, { slug }],
    },
  });

  if (!event || !event.isActive) {
    return <EventUnavailable />;
  }

  const photos = await prisma.photo.findMany({
    where: {
      eventId: event.id,
      status: "published",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DEFAULT_GALLERY_PAGE_SIZE,
  });

  return (
    <WeddingAlbumApp
      event={serializeEvent(event)}
      initialPhotos={photos.map((photo) =>
        serializePhoto(photo, false, false, { preferObjectPathUrls: true }),
      )}
    />
  );
}
