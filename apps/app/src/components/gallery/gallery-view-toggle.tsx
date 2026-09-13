"use client";

import { Grid2X2, Rows3 } from "lucide-react";
import type { GalleryViewMode } from "@/types";

export function GalleryViewToggle({
  value,
  onChange,
}: {
  value: GalleryViewMode;
  onChange: (mode: GalleryViewMode) => void;
}) {
  return (
    <div className="gallery-view-toggle" aria-label="Modo de visualizacao">
      <button
        className={value === "grid" ? "active" : ""}
        type="button"
        aria-label="Visualizacao em grade"
        aria-pressed={value === "grid"}
        title="Visualizacao em grade"
        onClick={() => onChange("grid")}
      >
        <Grid2X2 aria-hidden="true" />
      </button>
      <button
        className={value === "feed" ? "active" : ""}
        type="button"
        aria-label="Visualizacao em feed"
        aria-pressed={value === "feed"}
        title="Visualizacao em feed"
        onClick={() => onChange("feed")}
      >
        <Rows3 aria-hidden="true" />
      </button>
    </div>
  );
}
