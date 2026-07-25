import type { Event, Photo } from "@prisma/client";
import { getBunnyPublicUrl } from "@/lib/bunny-storage";
import type { PublicEvent, PublicPhoto } from "@/types";

export function serializeEvent(event: Event): PublicEvent {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    coupleName: event.coupleName,
    monogram: event.monogram,
    eventDate: event.eventDate.toISOString(),
    isActive: event.isActive,
  };
}

function parsePhotoTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === "string");
    }
  } catch {
    return [];
  }

  return [];
}

export function serializePhoto(
  photo: Pick<
    Photo,
    | "id"
    | "imageUrl"
    | "thumbnailUrl"
    | "guestName"
    | "guestSessionId"
    | "tags"
    | "likeCount"
    | "createdAt"
  > &
    Partial<Pick<Photo, "imageObjectPath" | "thumbnailObjectPath">>,
  isLiked = false,
  canDelete = false,
  options: { preferObjectPathUrls?: boolean } = {},
): PublicPhoto {
  const imageUrl =
    options.preferObjectPathUrls && photo.imageObjectPath
      ? getBunnyPublicUrl(photo.imageObjectPath)
      : photo.imageUrl;
  const thumbnailUrl =
    options.preferObjectPathUrls && photo.thumbnailObjectPath
      ? getBunnyPublicUrl(photo.thumbnailObjectPath)
      : photo.thumbnailUrl;

  return {
    id: photo.id,
    imageUrl,
    thumbnailUrl,
    guestName: photo.guestName,
    tags: parsePhotoTags(photo.tags),
    likeCount: photo.likeCount,
    isLiked,
    canDelete,
    createdAt: photo.createdAt.toISOString(),
  };
}
