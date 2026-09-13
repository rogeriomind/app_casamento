"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./album-gallery.module.css";

type Props = { src: string; alt: string; width: number; height: number; eager?: boolean };

function sized(src: string, width: number) {
  return `${src}${src.includes("?") ? "&" : "?"}largura=${width}`;
}

export function GalleryThumbnail({ src, alt, width, height, eager = false }: Props) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (eager || shouldLoad) return;
    const target = frameRef.current;
    if (!target || !("IntersectionObserver" in window)) { setShouldLoad(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldLoad(true);
      observer.disconnect();
    }, { rootMargin: "240px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [eager, shouldLoad]);

  return (
    <span ref={frameRef} className={styles.mediaFrame} data-state={state}>
      {shouldLoad && state !== "error" && <img src={sized(src, 640)} srcSet={`${sized(src, 320)} 320w, ${sized(src, 640)} 640w, ${sized(src, 960)} 960w`} sizes="(max-width: 540px) 48vw, (max-width: 900px) 31vw, (max-width: 1180px) 22vw, 18vw" alt={alt} width={width} height={height} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" onLoad={() => setState("loaded")} onError={() => setState("error")} />}
      {state !== "error" && <span className={styles.mediaSkeleton} aria-hidden="true" />}
      {state === "error" && (
        <span className={styles.mediaFallback} role="status">
          <strong>Miniatura indisponível</strong>
          <small>Abra o registro para tentar a mídia original.</small>
        </span>
      )}
    </span>
  );
}
