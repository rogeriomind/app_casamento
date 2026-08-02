"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaginatedPhotos, PublicPhoto } from "@/types";
import { PHOTOS_PAGE_SIZE } from "@/lib/gallery-pagination";

function readApiErrorFallback(response: Response) {
  return response
    .json()
    .then((data: { error?: string } | null) => data?.error)
    .catch(() => null);
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

export function prependGalleryPhoto(
  current: PublicPhoto[],
  incoming: PublicPhoto,
) {
  return [incoming, ...current.filter((photo) => photo.id !== incoming.id)];
}

export function replaceGalleryPhoto(
  current: PublicPhoto[],
  nextPhoto: PublicPhoto,
) {
  return current.map((photo) => (photo.id === nextPhoto.id ? nextPhoto : photo));
}

export function removeGalleryPhoto(current: PublicPhoto[], photoId: string) {
  return current.filter((photo) => photo.id !== photoId);
}

export function useGalleryPagination({
  eventId,
  guestSessionId,
  initialGallery,
}: {
  eventId: string;
  guestSessionId: string | null;
  initialGallery: PaginatedPhotos;
}) {
  const [photos, setPhotos] = useState(initialGallery.items);
  const [currentPage, setCurrentPage] = useState(initialGallery.page);
  const [nextCursor, setNextCursor] = useState(initialGallery.nextCursor);
  const [hasNextPage, setHasNextPage] = useState(initialGallery.hasNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [likedStateSessionId, setLikedStateSessionId] = useState<string | null>(
    null,
  );
  const [sentinelElement, setSentinelElement] =
    useState<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasLoadedPhotos = photos.length > 0;

  const fetchPhotos = useCallback(
    async ({ reset }: { reset: boolean }) => {
      if (inFlightRef.current) {
        return;
      }

      if (!reset && !hasNextPage) {
        return;
      }

      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      inFlightRef.current = true;
      if (reset) {
        setInitialError(null);
      } else {
        setLoadMoreError(null);
      }

      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          limit: String(initialGallery.limit || PHOTOS_PAGE_SIZE),
          page: String(reset ? 1 : currentPage + 1),
        });
        if (guestSessionId) {
          params.set("guestSessionId", guestSessionId);
        }
        if (!reset && nextCursor) {
          params.set("cursor", nextCursor);
        }

        const response = await fetch(
          `/api/events/${eventId}/photos?${params.toString()}`,
          { signal: abortController.signal },
        );
        if (!response.ok) {
          throw new Error(
            (await readApiErrorFallback(response)) ??
              "Nao foi possivel carregar a galeria.",
          );
        }

        const data = (await response.json()) as PaginatedPhotos;
        if (abortController.signal.aborted || !isMountedRef.current) {
          return;
        }

        setPhotos((current) =>
          reset ? data.items : mergeGalleryPhotos(current, data.items),
        );
        setCurrentPage(data.page);
        setNextCursor(data.nextCursor);
        setHasNextPage(data.hasNextPage);
        setLikedStateSessionId(guestSessionId);
      } catch (caughtError) {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Nao foi possivel carregar a galeria.";
        if (reset) {
          setInitialError(message);
        } else {
          setLoadMoreError(message);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        inFlightRef.current = false;
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [
      eventId,
      guestSessionId,
      hasNextPage,
      currentPage,
      initialGallery.limit,
      nextCursor,
    ],
  );

  const loadMore = useCallback(() => {
    void fetchPhotos({ reset: false });
  }, [fetchPhotos]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinelElement(node);
  }, []);

  const retry = useCallback(() => {
    void fetchPhotos({ reset: photos.length === 0 });
  }, [fetchPhotos, photos.length]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [eventId, guestSessionId]);

  useEffect(() => {
    setPhotos(initialGallery.items);
    setCurrentPage(initialGallery.page);
    setNextCursor(initialGallery.nextCursor);
    setHasNextPage(initialGallery.hasNextPage);
    setInitialError(null);
    setLoadMoreError(null);
    setLikedStateSessionId(null);
  }, [eventId, initialGallery]);

  useEffect(() => {
    if (!guestSessionId || likedStateSessionId === guestSessionId) {
      return;
    }

    void fetchPhotos({ reset: true });
  }, [fetchPhotos, guestSessionId, likedStateSessionId]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    if (!sentinelElement || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && document.visibilityState === "visible") {
        void fetchPhotos({ reset: false });
      }
    }, {
      root: null,
      rootMargin: "900px 0px 900px",
      threshold: 0,
    });

    observer.observe(sentinelElement);
    return () => observer.disconnect();
  }, [fetchPhotos, hasNextPage, sentinelElement]);

  return useMemo(
    () => ({
      photos,
      setPhotos,
      currentPage,
      hasLoadedPhotos,
      isLoading,
      isLoadingMore,
      hasNextPage,
      initialError,
      loadMoreError,
      sentinelRef,
      loadMore,
      retry,
      refresh: () => fetchPhotos({ reset: true }),
    }),
    [
      currentPage,
      fetchPhotos,
      hasLoadedPhotos,
      hasNextPage,
      initialError,
      isLoading,
      isLoadingMore,
      loadMore,
      loadMoreError,
      photos,
      retry,
      sentinelRef,
    ],
  );
}
