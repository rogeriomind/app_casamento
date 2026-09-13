"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardIcon } from "./dashboard-icon";
import styles from "./album-gallery.module.css";

type Props = { eventId: string; photoId: string; initialFavorite: boolean };

export function FavoriteButton({ eventId, photoId, initialFavorite }: Props) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      router.refresh();
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
