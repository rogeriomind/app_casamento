"use client";

import type { PublicPhoto } from "@/types";
import { MemoizedPhotoFeedCard } from "@/components/gallery/photo-feed-card";

export function PhotoFeed({
  photos,
  onSelectPhoto,
  onToggleLike,
}: {
  photos: PublicPhoto[];
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
}) {
  return (
    <div className="photo-feed" aria-label="Feed de fotos do casamento">
      {photos.map((photo, index) => (
        <MemoizedPhotoFeedCard
          key={photo.id}
          photo={photo}
          isPriority={index === 0}
          onSelectPhoto={onSelectPhoto}
          onToggleLike={onToggleLike}
        />
      ))}
    </div>
  );
}
