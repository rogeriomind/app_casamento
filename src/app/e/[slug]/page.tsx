import { EventUnavailable } from "@/components/event-unavailable";
import { WeddingAlbumApp } from "@/components/wedding-album-app";
import { getBunnyPublicBaseUrl } from "@/lib/bunny-storage";
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

  const bunnyPublicUrlPrefix = `${getBunnyPublicBaseUrl()}/`;
  const photos = await prisma.photo.findMany({
    where: {
      eventId: event.id,
      status: "published",
      imageUrl: {
        startsWith: bunnyPublicUrlPrefix,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <WeddingAlbumApp
      event={serializeEvent(event)}
      initialPhotos={photos.map((photo) => serializePhoto(photo))}
    />
  );
}
