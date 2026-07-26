"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaginatedPhotos, PublicPhoto } from "@/types";

const GALLERY_PAGE_SIZE = 12;

function readApiErrorFallback(response: Response) {
  return response
    .json()
    .then((data: { error?: string } | null) => data?.error)
    .catch(() => null);
}

function encodeClientCursor(photo: PublicPhoto) {
  const json = JSON.stringify({ createdAt: photo.createdAt, id: photo.id });
  const base64 = window.btoa(json);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function mergeGalleryPhotos(
  current: PublicPhoto[],
  incoming: PublicPhoto[],
) {
  const seen = new Set<string>();
  return [...incoming, ...current]
    .filter((photo) => {
      if (seen.has(photo.id)) {
        return false;
      }
      seen.add(photo.id);
      return true;
    })
    .sort((a, b) => {
      const createdAtDiff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return createdAtDiff || b.id.localeCompare(a.id);
    });
}

export function useGalleryPagination({
  eventId,
  guestSessionId,
  initialPhotos,
}: {
  eventId: string;
  guestSessionId: string | null;
  initialPhotos: PublicPhoto[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [nextCursor, setNextCursor] = useState<string | null>(() => {
    if (typeof window === "undefined" || initialPhotos.length < GALLERY_PAGE_SIZE) {
      return null;
    }

    return encodeClientCursor(initialPhotos[initialPhotos.length - 1]);
  });
  const [hasNextPage, setHasNextPage] = useState(
    initialPhotos.length >= GALLERY_PAGE_SIZE,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedStateSessionId, setLikedStateSessionId] = useState<string | null>(
    null,
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  const hasLoadedPhotos = photos.length > 0;

  const fetchPhotos = useCallback(
    async ({ reset }: { reset: boolean }) => {
      if (inFlightRef.current) {
        return;
      }

      if (!reset && (!hasNextPage || !nextCursor)) {
        return;
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      inFlightRef.current = true;
      setError(null);
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({ limit: String(GALLERY_PAGE_SIZE) });
        if (guestSessionId) {
          params.set("guestSessionId", guestSessionId);
        }
        if (!reset && nextCursor) {
          params.set("cursor", nextCursor);
        }

        const response = await fetch(
          `/api/events/${eventId}/photos?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error(
            (await readApiErrorFallback(response)) ??
              "Nao foi possivel carregar a galeria.",
          );
        }

        const data = (await response.json()) as PaginatedPhotos;
        setPhotos((current) =>
          reset ? data.items : mergeGalleryPhotos(current, data.items),
        );
        setNextCursor(data.nextCursor);
        setHasNextPage(data.hasNextPage);
        setLikedStateSessionId(guestSessionId);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nao foi possivel carregar a galeria.",
        );
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [eventId, guestSessionId, hasNextPage, nextCursor],
  );

  const retry = useCallback(() => {
    void fetchPhotos({ reset: photos.length === 0 });
  }, [fetchPhotos, photos.length]);

  useEffect(() => {
    if (!guestSessionId || likedStateSessionId === guestSessionId) {
      return;
    }

    void fetchPhotos({ reset: true });
  }, [fetchPhotos, guestSessionId, likedStateSessionId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && document.visibilityState === "visible") {
        void fetchPhotos({ reset: false });
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchPhotos, hasNextPage]);

  return useMemo(
    () => ({
      photos,
      setPhotos,
      hasLoadedPhotos,
      isLoading,
      isLoadingMore,
      hasNextPage,
      error,
      sentinelRef,
      retry,
      refresh: () => fetchPhotos({ reset: true }),
    }),
    [
      error,
      fetchPhotos,
      hasLoadedPhotos,
      hasNextPage,
      isLoading,
      isLoadingMore,
      photos,
      retry,
    ],
  );
}
