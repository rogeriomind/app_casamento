"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GalleryViewMode } from "@/types";

const DEFAULT_GALLERY_VIEW_MODE: GalleryViewMode = "grid";

export function getGalleryViewStorageKey(eventId: string) {
  return `wedding-album:${eventId}:gallery-view`;
}

function parseGalleryViewMode(value: string | null): GalleryViewMode {
  return value === "feed" || value === "grid"
    ? value
    : DEFAULT_GALLERY_VIEW_MODE;
}

export function useGalleryViewMode(eventId: string) {
  const [viewMode, setViewModeState] = useState<GalleryViewMode>(
    DEFAULT_GALLERY_VIEW_MODE,
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      setViewModeState(
        parseGalleryViewMode(
          window.localStorage.getItem(getGalleryViewStorageKey(eventId)),
        ),
      );
    } catch {
      setViewModeState(DEFAULT_GALLERY_VIEW_MODE);
    }
    setIsHydrated(true);
  }, [eventId]);

  const setViewMode = useCallback(
    (nextMode: GalleryViewMode) => {
      setViewModeState(nextMode);
      try {
        window.localStorage.setItem(
          getGalleryViewStorageKey(eventId),
          nextMode,
        );
      } catch {
        // The in-memory state still updates if localStorage is unavailable.
      }
    },
    [eventId],
  );

  return useMemo(
    () => ({ viewMode, setViewMode, isHydrated }),
    [isHydrated, setViewMode, viewMode],
  );
}
