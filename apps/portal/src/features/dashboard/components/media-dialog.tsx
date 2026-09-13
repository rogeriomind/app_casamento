"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "./album-gallery.module.css";

type Props = { closeHref: string; returnFocusId: string; children: ReactNode };

export function MediaDialog({ closeHref, returnFocusId, children }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLElement>(null);
  const close = useCallback(() => {
    sessionStorage.setItem("album-return-focus", returnFocusId);
    router.push(closeHref);
  }, [closeHref, returnFocusId, router]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], iframe, [tabindex]:not([tabindex="-1"])') ?? [])].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) { event.preventDefault(); return; }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1) : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault(); focusable[nextIndex].focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [close]);
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Mídia ampliada" tabIndex={-1}>
      <button className={styles.close} type="button" onClick={close} aria-label="Fechar detalhe">×</button>{children}
    </section>
  </div>;
}

export function GalleryFocusRestore() {
  useEffect(() => {
    const id = sessionStorage.getItem("album-return-focus");
    if (!id) return;
    sessionStorage.removeItem("album-return-focus");
    document.getElementById(id)?.focus();
  }, []);
  return null;
}
