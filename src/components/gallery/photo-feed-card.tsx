"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Heart, Image as ImageIcon, Play } from "lucide-react";
import type { PublicPhoto } from "@/types";
import { normalizeGuestName } from "@/lib/validators";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function getDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatPhotoRelativeTime(value: string, now = new Date()) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return "";
  }

  const diffInMs = now.getTime() - createdAt.getTime();
  if (diffInMs >= 0 && diffInMs < 60_000) {
    return "agora";
  }

  if (diffInMs >= 0 && diffInMs < 60 * 60_000) {
    return `${Math.max(1, Math.floor(diffInMs / 60_000))} min`;
  }

  if (diffInMs >= 0 && diffInMs < 24 * 60 * 60_000) {
    return `${Math.max(1, Math.floor(diffInMs / (60 * 60_000)))} h`;
  }

  const today = getDayStart(now);
  const createdDay = getDayStart(createdAt);
  const dayDiff = Math.round(
    (today.getTime() - createdDay.getTime()) / (24 * 60 * 60_000),
  );

  if (dayDiff === 1) {
    return "ontem";
  }

  return DATE_FORMATTER.format(createdAt);
}

export function PhotoFeedCard({
  photo,
  isPriority,
  onSelectPhoto,
  onToggleLike,
}: {
  photo: PublicPhoto;
  isPriority: boolean;
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
}) {
  const lastTapAtRef = useRef(0);
  const ignoreNextClickRef = useRef(false);
  const isVideo = photo.mediaType === "video";
  const mediaLabel = isVideo ? "video" : "foto";
  const primaryImageUrl = isVideo ? photo.thumbnailUrl : photo.imageUrl;
  const fallbackImageUrl =
    !isVideo && photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl
      ? photo.thumbnailUrl
      : null;
  const [displayImageUrl, setDisplayImageUrl] = useState(primaryImageUrl);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const normalizedGuestName = normalizeGuestName(photo.guestName);
  const guestInitial =
    normalizedGuestName.charAt(0).toLocaleUpperCase("pt-BR") || "?";
  const relativeTime = formatPhotoRelativeTime(photo.createdAt);

  useEffect(() => {
    setDisplayImageUrl(primaryImageUrl);
    setImageLoadFailed(false);
  }, [photo.id, primaryImageUrl]);

  function handleImageError() {
    if (fallbackImageUrl && displayImageUrl !== fallbackImageUrl) {
      setDisplayImageUrl(fallbackImageUrl);
      return;
    }

    setImageLoadFailed(true);
  }

  function handleImagePointerUp() {
    const now = Date.now();
    if (now - lastTapAtRef.current < 360) {
      lastTapAtRef.current = 0;
      ignoreNextClickRef.current = true;
      onToggleLike(photo);
      return;
    }

    lastTapAtRef.current = now;
  }

  function handleImageClick() {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    onSelectPhoto(photo);
  }

  return (
    <article className={`photo-feed-card ${photo.isLiked ? "liked" : ""}`}>
      <header className="photo-feed-header">
        <span className="photo-feed-avatar" aria-hidden="true">
          {guestInitial}
        </span>
        <strong>{photo.guestName}</strong>
        {relativeTime && <time dateTime={photo.createdAt}>{relativeTime}</time>}
      </header>

      <button
        className="photo-feed-image-wrap"
        type="button"
        onClick={handleImageClick}
        onPointerUp={handleImagePointerUp}
        aria-label={`Abrir ${mediaLabel} enviada por ${photo.guestName}`}
      >
        {imageLoadFailed || !displayImageUrl ? (
          <span className="photo-feed-image-placeholder">
            <ImageIcon aria-hidden="true" />
            <span>{isVideo ? "Video indisponivel" : "Foto indisponivel"}</span>
          </span>
        ) : (
          <>
            <img
              className="photo-feed-image"
              src={displayImageUrl}
              alt={`${isVideo ? "Video" : "Foto"} enviada por ${photo.guestName}`}
              loading={isPriority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={isPriority ? "high" : "auto"}
              onError={handleImageError}
            />
            {isVideo && (
              <span className="video-feed-badge">
                <Play aria-hidden="true" />
              </span>
            )}
          </>
        )}
      </button>

      <footer className="photo-feed-footer">
        <div className="photo-feed-actions">
          <button
            className={`photo-feed-like-button ${photo.isLiked ? "liked" : ""}`}
            type="button"
            onClick={() => onToggleLike(photo)}
            aria-label={photo.isLiked ? "Remover curtida" : "Curtir foto"}
            aria-pressed={photo.isLiked}
          >
            <Heart aria-hidden="true" />
            <span>{photo.isLiked ? "Curtido" : "Curtir"}</span>
          </button>
          <span className="photo-feed-like-count">
            {photo.likeCount === 1 ? "1 curtida" : `${photo.likeCount} curtidas`}
          </span>
          <button
            className="photo-feed-open-button"
            type="button"
            onClick={() => onSelectPhoto(photo)}
          >
            {isVideo ? <Play aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
            Abrir {mediaLabel}
          </button>
        </div>

        {photo.tags.length > 0 && (
          <div className="photo-feed-tags" aria-label="Tags da foto">
            {photo.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </footer>
    </article>
  );
}

export const MemoizedPhotoFeedCard = memo(PhotoFeedCard);
