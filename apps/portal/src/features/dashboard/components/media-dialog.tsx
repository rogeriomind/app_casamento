"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./album-gallery.module.css";

type Props = { onClose(): void; children: ReactNode };

export function MediaDialog({ onClose, children }: Props) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], iframe, [tabindex]:not([tabindex="-1"])') ?? [])].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) { event.preventDefault(); return; }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1) : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault(); focusable[nextIndex].focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Mídia ampliada" tabIndex={-1}>
      <button className={styles.close} type="button" onClick={onClose} aria-label="Fechar detalhe">×</button>{children}
    </section>
  </div>;
}
