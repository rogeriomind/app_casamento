"use client";

import type { PublicPhoto } from "@/types";
import {
  MemoizedPhotoGridCard,
  type PhotoGridScope,
} from "@/components/gallery/photo-grid-card";

export function PhotoGrid({
  photos,
  galleryScope,
  highlightedPhotoId,
  deletingPhotoIds,
  onDeletePhoto,
  onSelectPhoto,
  onToggleLike,
}: {
  photos: PublicPhoto[];
  galleryScope: PhotoGridScope;
  highlightedPhotoId: string | null;
  deletingPhotoIds: Set<string>;
  onDeletePhoto: (photo: PublicPhoto) => void;
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
}) {
  return (
    <div className="photo-grid" aria-label="Fotos do casamento">
      {photos.map((photo, index) => (
        <MemoizedPhotoGridCard
          key={photo.id}
          photo={photo}
          galleryScope={galleryScope}
          isHighlighted={highlightedPhotoId === photo.id}
          isDeleting={deletingPhotoIds.has(photo.id)}
          isPriority={index < 6}
          onDeletePhoto={onDeletePhoto}
          onSelectPhoto={onSelectPhoto}
          onToggleLike={onToggleLike}
        />
      ))}
    </div>
  );
}
