import { EventUnavailable } from "@/components/event-unavailable";
import { WeddingAlbumApp } from "@/components/wedding-album-app";
import {
  encodeGalleryCursor,
  PHOTOS_PAGE_SIZE,
} from "@/lib/gallery-pagination";
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
    take: PHOTOS_PAGE_SIZE + 1,
  });
  const visiblePhotos = photos.slice(0, PHOTOS_PAGE_SIZE);
  const lastVisiblePhoto =
    visiblePhotos.length > 0 ? visiblePhotos[visiblePhotos.length - 1] : null;
  const hasNextPage = photos.length > PHOTOS_PAGE_SIZE;

  return (
    <WeddingAlbumApp
      event={serializeEvent(event)}
      initialGallery={{
        items: visiblePhotos.map((photo) =>
          serializePhoto(photo, false, false, { preferObjectPathUrls: true }),
        ),
        page: 1,
        limit: PHOTOS_PAGE_SIZE,
        hasNextPage,
        nextCursor:
          hasNextPage && lastVisiblePhoto
            ? encodeGalleryCursor(lastVisiblePhoto)
            : null,
      }}
    />
  );
}
