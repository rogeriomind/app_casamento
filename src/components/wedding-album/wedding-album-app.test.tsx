import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoFeedCard } from "@/components/gallery/photo-feed-card";
import {
  GalleryScreen,
  PhotoGridButton,
  PhotoPreviewModal,
  WelcomeScreen,
} from "@/components/wedding-album/wedding-album-app";
import { getGalleryViewStorageKey } from "@/hooks/use-gallery-view-mode";
import type { PublicEvent, PublicPhoto } from "@/types";

function photo(overrides: Partial<PublicPhoto> = {}): PublicPhoto {
  return {
    id: "photo-1",
    imageUrl: "https://cdn.example.com/photos/original.jpg",
    thumbnailUrl: "https://cdn.example.com/thumbnails/thumb.webp",
    guestName: "Maria",
    tags: [],
    likeCount: 2,
    isLiked: false,
    canDelete: false,
    createdAt: "2026-07-25T12:00:00.000Z",
    ...overrides,
  };
}

const event: PublicEvent = {
  id: "event-1",
  slug: "leticia-rogerio",
  name: "Casamento",
  coupleName: "Leticia & Rogerio",
  monogram: "L&R",
  eventDate: "2026-07-25T12:00:00.000Z",
  isActive: true,
};

function renderGalleryScreen({
  eventOverride = event,
  photos = [photo()],
  hasNextPage = false,
  loadMoreError = null,
  onToggleLike = vi.fn(),
  onLoadMore = vi.fn(),
}: {
  eventOverride?: PublicEvent;
  photos?: PublicPhoto[];
  hasNextPage?: boolean;
  loadMoreError?: string | null;
  onToggleLike?: (photo: PublicPhoto) => void;
  onLoadMore?: () => void;
} = {}) {
  return render(
    <GalleryScreen
      event={eventOverride}
      photos={photos}
      guestName="Maria"
      highlightedPhotoId={null}
      isGalleryLoading={false}
      isLoadingMore={false}
      hasNextPage={hasNextPage}
      isUploading={false}
      deletingPhotoIds={new Set()}
      error={null}
      loadMoreError={loadMoreError}
      sentinelRef={vi.fn()}
      onAddPhoto={vi.fn()}
      onDeletePhoto={vi.fn()}
      onLoadMore={onLoadMore}
      onOpenAccount={vi.fn()}
      onSelectPhoto={vi.fn()}
      onToggleLike={onToggleLike}
      onRetry={vi.fn()}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wedding album image rendering", () => {
  it("renders the welcome screen while keeping the start button gated by hydration", () => {
    const { rerender } = render(
      <WelcomeScreen event={event} isReady={false} onStart={vi.fn()} />,
    );

    expect(screen.getByText("Bem-vindo ao album do casamento")).toBeVisible();
    expect(screen.getByRole("button", { name: "Comecar" })).toBeDisabled();
    expect(screen.queryByText("Carregando album...")).not.toBeInTheDocument();

    rerender(<WelcomeScreen event={event} isReady onStart={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Comecar" })).toBeEnabled();
  });

  it("renders the gallery card with the thumbnail URL", () => {
    render(
      <PhotoGridButton
        photo={photo()}
        galleryScope="all"
        isHighlighted={false}
        isDeleting={false}
        isPriority
        onDeletePhoto={vi.fn()}
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Foto enviada por Maria")).toHaveAttribute(
      "src",
      "https://cdn.example.com/thumbnails/thumb.webp",
    );
  });

  it("falls back to the original URL for old photos without thumbnails", () => {
    render(
      <PhotoGridButton
        photo={photo({ thumbnailUrl: null })}
        galleryScope="all"
        isHighlighted={false}
        isDeleting={false}
        isPriority={false}
        onDeletePhoto={vi.fn()}
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Foto enviada por Maria")).toHaveAttribute(
      "src",
      "https://cdn.example.com/photos/original.jpg",
    );
  });

  it("renders the modal preview and download with the original URL", () => {
    render(
      <PhotoPreviewModal
        photo={photo()}
        onToggleLike={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Foto enviada por Maria")).toHaveAttribute(
      "src",
      "https://cdn.example.com/photos/original.jpg",
    );
    expect(screen.getByRole("link", { name: /baixar foto/i })).toHaveAttribute(
      "href",
      "https://cdn.example.com/photos/original.jpg",
    );
  });
});

describe("gallery view modes", () => {
  it("uses grid as the default gallery view", () => {
    renderGalleryScreen();

    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));

    expect(
      screen.getByRole("button", { name: "Visualizacao em grade" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".photo-grid")).toBeInTheDocument();
  });

  it("lets the guest switch to feed view", () => {
    renderGalleryScreen();

    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizacao em feed" }));

    expect(document.querySelector(".photo-feed")).toBeInTheDocument();
    expect(document.querySelector(".photo-grid")).not.toBeInTheDocument();
  });

  it("persists the selected view in localStorage", () => {
    renderGalleryScreen();

    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizacao em feed" }));

    expect(window.localStorage.getItem(getGalleryViewStorageKey(event.id))).toBe(
      "feed",
    );
  });

  it("keeps the persisted view isolated by event id", () => {
    const { unmount } = renderGalleryScreen();

    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizacao em feed" }));
    unmount();

    renderGalleryScreen({
      eventOverride: { ...event, id: "event-2", slug: "outro-evento" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));

    expect(
      screen.getByRole("button", { name: "Visualizacao em grade" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(getGalleryViewStorageKey("event-2"))).toBe(
      null,
    );
  });

  it("renders grid cards with thumbnail URLs", () => {
    render(
      <PhotoGridButton
        photo={photo()}
        galleryScope="all"
        isHighlighted={false}
        isDeleting={false}
        isPriority
        onDeletePhoto={vi.fn()}
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Foto enviada por Maria")).toHaveAttribute(
      "src",
      "https://cdn.example.com/thumbnails/thumb.webp",
    );
  });

  it("renders feed cards with original image URLs", () => {
    render(
      <PhotoFeedCard
        photo={photo()}
        isPriority
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Foto enviada por Maria")).toHaveAttribute(
      "src",
      "https://cdn.example.com/photos/original.jpg",
    );
  });

  it("falls back to the thumbnail when a feed original image fails", () => {
    render(
      <PhotoFeedCard
        photo={photo()}
        isPriority
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByAltText("Foto enviada por Maria"));

    expect(screen.getByAltText("Foto enviada por Maria")).toHaveAttribute(
      "src",
      "https://cdn.example.com/thumbnails/thumb.webp",
    );
  });

  it("shows a controlled placeholder when a feed image has no fallback", () => {
    render(
      <PhotoFeedCard
        photo={photo({ thumbnailUrl: null })}
        isPriority
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByAltText("Foto enviada por Maria"));

    expect(screen.queryByAltText("Foto enviada por Maria")).not.toBeInTheDocument();
    expect(screen.getByText("Foto indisponivel")).toBeVisible();
  });

  it("calls the feed like callback once from the explicit like button", () => {
    const onToggleLike = vi.fn();
    render(
      <PhotoFeedCard
        photo={photo()}
        isPriority
        onSelectPhoto={vi.fn()}
        onToggleLike={onToggleLike}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Curtir foto" }));

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onToggleLike).toHaveBeenCalledWith(expect.objectContaining({ id: "photo-1" }));
  });

  it("shows the load more fallback when more pages exist", () => {
    renderGalleryScreen({ hasNextPage: true });

    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));

    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeVisible();
  });

  it("does not fetch photos when switching between grid and feed", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderGalleryScreen();

    fireEvent.click(screen.getByRole("button", { name: "Todas as fotos" }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizacao em feed" }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizacao em grade" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
