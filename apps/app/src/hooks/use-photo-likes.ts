"use client";

import { useCallback } from "react";
import type { PublicGuestSession, PublicPhoto } from "@/types";

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? "Algo nao saiu como esperado.";
}

export function usePhotoLikes({
  eventId,
  session,
  onPhotoUpdate,
  onError,
  requireSession,
}: {
  eventId: string;
  session: PublicGuestSession | null;
  onPhotoUpdate: (photo: PublicPhoto) => void;
  onError: (message: string) => void;
  requireSession: () => void;
}) {
  const togglePhotoLike = useCallback(
    async (photo: PublicPhoto) => {
      if (!session) {
        requireSession();
        return;
      }

      const nextLiked = !photo.isLiked;
      const optimisticPhoto = {
        ...photo,
        isLiked: nextLiked,
        likeCount: Math.max(0, photo.likeCount + (nextLiked ? 1 : -1)),
      };
      onPhotoUpdate(optimisticPhoto);

      try {
        const response = await fetch(
          `/api/events/${eventId}/photos/${photo.id}/like`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guestSessionId: session.guestSessionId,
              liked: nextLiked,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        onPhotoUpdate((await response.json()) as PublicPhoto);
      } catch (error) {
        onPhotoUpdate(photo);
        onError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a curtida.",
        );
      }
    },
    [eventId, onError, onPhotoUpdate, requireSession, session],
  );

  return { togglePhotoLike };
}
