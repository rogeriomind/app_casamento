"use client";

import { Loader2 } from "lucide-react";
import type { RefObject } from "react";

export function GalleryLoadMoreSentinel({
  sentinelRef,
  hasNextPage,
  isLoadingMore,
  loadMoreError,
  showLoadMoreButton,
  onLoadMore,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  showLoadMoreButton: boolean;
  onLoadMore: () => void;
}) {
  if (!hasNextPage) {
    return null;
  }

  return (
    <div className="gallery-load-sentinel">
      <div ref={sentinelRef} className="gallery-sentinel" aria-hidden="true" />
      {showLoadMoreButton && (
        <div className="gallery-load-more">
          {loadMoreError && (
            <p className="gallery-load-more-error" role="alert">
              {loadMoreError}
            </p>
          )}
          <button type="button" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <>
                <Loader2 aria-hidden="true" className="spin-icon small" />
                Carregando
              </>
            ) : (
              "Carregar mais"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
