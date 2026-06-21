import type { Event, Photo } from "@prisma/client";
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
  >,
  isLiked = false,
  canDelete = false,
): PublicPhoto {
  return {
    id: photo.id,
    imageUrl: photo.imageUrl,
    thumbnailUrl: photo.thumbnailUrl,
    guestName: photo.guestName,
    tags: parsePhotoTags(photo.tags),
    likeCount: photo.likeCount,
    isLiked,
    canDelete,
    createdAt: photo.createdAt.toISOString(),
  };
}
