"use client";

import { useEffect, useState } from "react";
import { DashboardIcon } from "./dashboard-icon";
import { favoriteChangedEvent, type FavoriteChangedDetail } from "./favorite-events";
import styles from "./album-gallery.module.css";

type Props = { eventId: string; photoId: string; initialFavorite: boolean };

export function FavoriteButton({ eventId, photoId, initialFavorite }: Props) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleFavoriteChange(event: Event) {
      const detail = (event as CustomEvent<FavoriteChangedDetail>).detail;
      if (detail.eventId === eventId && detail.photoId === photoId) {
        setFavorite(detail.favorited);
      }
    }

    window.addEventListener(favoriteChangedEvent, handleFavoriteChange);
    return () => window.removeEventListener(favoriteChangedEvent, handleFavoriteChange);
  }, [eventId, photoId]);

  async function toggle() {
    if (busy) return;
    const next = !favorite;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/eventos/${eventId}/fotos/${photoId}/favorito`, {
        method: next ? "PUT" : "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Não foi possível atualizar o favorito.");
      }
      setFavorite(next);
      window.dispatchEvent(new CustomEvent<FavoriteChangedDetail>(favoriteChangedEvent, {
        detail: { eventId, photoId, favorited: next },
      }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className={styles.favoriteButton}
        type="button"
        aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-pressed={favorite}
        disabled={busy}
        onClick={toggle}
      >
        <DashboardIcon name="heart" />
      </button>
      {error && <span className={styles.favoriteError} role="status">{error}</span>}
    </>
  );
}
