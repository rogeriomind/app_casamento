"use client";

import { memo, useRef } from "react";
import { Heart, Loader2, Trash2 } from "lucide-react";
import type { PublicPhoto } from "@/types";

export type PhotoGridScope = "all" | "mine";

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
            ? `Toque duas vezes para curtir. Segure por 2 segundos para abrir foto enviada por ${photo.guestName}`
            : `Abrir foto enviada por ${photo.guestName}`
        }
      >
        <img
          src={gridImageUrl}
          alt={`Foto enviada por ${photo.guestName}`}
          width={720}
          height={720}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={isPriority ? "high" : "auto"}
        />
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
          aria-label={`Excluir foto enviada por ${photo.guestName}`}
          title="Excluir foto"
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
