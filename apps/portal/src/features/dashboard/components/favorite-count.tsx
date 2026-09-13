"use client";

import { useEffect, useState } from "react";
import { favoriteChangedEvent, type FavoriteChangedDetail } from "./favorite-events";

export function FavoriteCount({ eventId, initialTotal }: { eventId: string; initialTotal: number }) {
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    function handleFavoriteChange(event: Event) {
      const detail = (event as CustomEvent<FavoriteChangedDetail>).detail;
      if (detail.eventId !== eventId) return;
      setTotal((current) => Math.max(0, current + (detail.favorited ? 1 : -1)));
    }

    window.addEventListener(favoriteChangedEvent, handleFavoriteChange);
    return () => window.removeEventListener(favoriteChangedEvent, handleFavoriteChange);
  }, [eventId]);

  return <span>({total})</span>;
}
