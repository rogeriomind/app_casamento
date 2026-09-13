"use client";

import { memo, useRef } from "react";
import { Heart, Loader2, Play, Trash2 } from "lucide-react";
import type { PublicPhoto } from "@/types";

export type PhotoGridScope = "all" | "mine";

function formatMediaDuration(durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds < 1) {
    return null;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PhotoGridCard({
  photo,
  galleryScope,
  isHighlighted,
  isDeleting,
  isPriority,
  onDeletePhoto,
  onSelectPhoto,
  onToggleLike,
}: {
  photo: PublicPhoto;
  galleryScope: PhotoGridScope;
  isHighlighted: boolean;
  isDeleting: boolean;
  isPriority: boolean;
  onDeletePhoto: (photo: PublicPhoto) => void;
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
}) {
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const lastTapAtRef = useRef(0);

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function handlePointerDown() {
    if (galleryScope !== "all") {
      return;
    }

    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onSelectPhoto(photo);
    }, 2000);
  }

  function handlePointerUp() {
    if (galleryScope !== "all") {
      return;
    }

    clearLongPress();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const now = Date.now();
    if (now - lastTapAtRef.current < 360) {
      lastTapAtRef.current = 0;
      onToggleLike(photo);
      return;
    }

    lastTapAtRef.current = now;
  }

  const canDelete = galleryScope === "mine" && photo.canDelete;
  const gridImageUrl = photo.thumbnailUrl ?? photo.imageUrl;
  const isVideo = photo.mediaType === "video";
  const mediaLabel = isVideo ? "video" : "foto";
  const durationLabel = isVideo ? formatMediaDuration(photo.durationSeconds) : null;

  return (
    <div
      className={`photo-card ${isHighlighted ? "highlighted" : ""} ${
        photo.isLiked ? "liked" : ""
      } ${isDeleting ? "deleting" : ""}`}
    >
      <button
        className="photo-card-main"
        type="button"
        disabled={isDeleting}
        onClick={() => {
          if (galleryScope !== "all") {
            onSelectPhoto(photo);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(event) => {
          if (galleryScope === "all") {
            event.preventDefault();
          }
        }}
        aria-label={
          galleryScope === "all"
            ? `Toque duas vezes para curtir. Segure por 2 segundos para abrir ${mediaLabel} enviada por ${photo.guestName}`
            : `Abrir ${mediaLabel} enviada por ${photo.guestName}`
        }
      >
        {gridImageUrl ? (
          <img
            src={gridImageUrl}
            alt={`${isVideo ? "Video" : "Foto"} enviada por ${photo.guestName}`}
            width={720}
            height={720}
            loading={isPriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={isPriority ? "high" : "auto"}
          />
        ) : (
          <span className="photo-card-placeholder">
            {isVideo ? "Video indisponivel" : "Foto indisponivel"}
          </span>
        )}
        {isVideo && (
          <span className="video-grid-badge">
            <Play aria-hidden="true" />
            {durationLabel && <small>{durationLabel}</small>}
          </span>
        )}
        {galleryScope === "all" && (
          <span className="photo-like-badge">
            <Heart aria-hidden="true" />
            {photo.likeCount}
          </span>
        )}
      </button>

      {canDelete && (
        <button
          className="photo-delete-button"
          type="button"
          disabled={isDeleting}
          onClick={() => onDeletePhoto(photo)}
          aria-label={`Excluir ${mediaLabel} enviada por ${photo.guestName}`}
          title={`Excluir ${mediaLabel}`}
        >
          {isDeleting ? (
            <Loader2 aria-hidden="true" className="spin-icon small" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

export const MemoizedPhotoGridCard = memo(PhotoGridCard);
