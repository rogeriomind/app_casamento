"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { FavoriteButton } from "./favorite-button";
import { MediaDialog } from "./media-dialog";
import styles from "./album-gallery.module.css";

type ModalPhoto = {
  id: string;
  altText: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  mediaType: "IMAGE" | "VIDEO";
  tags: string[];
  authorName: string | null;
  likeCount: number;
  durationSeconds: number | null;
  remoteEmbedUrl: string | null;
  isFavorite: boolean;
  grant: string;
};

type ModalContextValue = { open(photoId: string, href: string): void };
const ModalContext = createContext<ModalContextValue | null>(null);

function durationLabel(seconds: number | null) {
  if (!seconds || seconds < 0) return null;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function photoIdFromLocation() {
  return new URL(window.location.href).searchParams.get("foto");
}

export function GalleryModalProvider({ eventId, photos, initialSelected, closeHref, children }: {
  eventId: string;
  photos: ModalPhoto[];
  initialSelected: ModalPhoto | null;
  closeHref: string;
  children: ReactNode;
}) {
  const available = useMemo(() => new Map([...photos, ...(initialSelected ? [initialSelected] : [])].map((photo) => [photo.id, photo])), [initialSelected, photos]);
  const [selectedId, setSelectedId] = useState(initialSelected?.id ?? null);

  useEffect(() => {
    const onPopState = () => setSelectedId(photoIdFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const open = useCallback((photoId: string, href: string) => {
    window.history.pushState({ ...window.history.state, albumModal: true }, "", href);
    setSelectedId(photoId);
  }, []);

  const close = useCallback(() => {
    const returnFocusId = selectedId;
    setSelectedId(null);
    if (window.history.state?.albumModal) window.history.back();
    else window.history.replaceState(window.history.state, "", closeHref);
    window.requestAnimationFrame(() => returnFocusId && document.getElementById(returnFocusId)?.focus());
  }, [closeHref, selectedId]);

  const selected = selectedId ? available.get(selectedId) ?? null : null;
  return (
    <ModalContext.Provider value={{ open }}>
      {children}
      {selected && (
        <MediaDialog onClose={close}>
          {selected.mediaType === "VIDEO" && selected.remoteEmbedUrl
            ? <iframe src={selected.remoteEmbedUrl} title="Vídeo do casamento" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen />
            : <img src={`/api/eventos/${eventId}/fotos/${selected.id}?variante=original&grant=${encodeURIComponent(selected.grant)}`} alt={selected.altText} width={selected.width ?? 1000} height={selected.height ?? 1000} />}
          <div className={styles.detail}>
            <div className={styles.detailTitle}><strong>{selected.mediaType === "VIDEO" ? "Vídeo" : "Foto"} do álbum</strong><FavoriteButton eventId={eventId} photoId={selected.id} initialFavorite={selected.isFavorite} /></div>
            <p>{selected.authorName ? `Nome informado no envio: ${selected.authorName}` : "Registro do evento"}</p>
            <div><time dateTime={selected.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.createdAt))}</time>{selected.durationSeconds && <span>{durationLabel(selected.durationSeconds)}</span>}<span>{selected.likeCount} {selected.likeCount === 1 ? "curtida no evento" : "curtidas no evento"}</span></div>
            {selected.tags.length > 0 && <ul>{selected.tags.map((item) => <li key={item}>#{item}</li>)}</ul>}
          </div>
        </MediaDialog>
      )}
    </ModalContext.Provider>
  );
}

export function GalleryOpenLink({ href, photoId, className, ariaLabel, children }: {
  href: string;
  photoId: string;
  className: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const context = useContext(ModalContext);
  function activate(event: MouseEvent<HTMLAnchorElement>) {
    if (!context || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    context.open(photoId, href);
  }
  return <a className={className} href={href} aria-label={ariaLabel} onClick={activate}>{children}</a>;
}
