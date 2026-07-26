import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PhotoGridButton,
  PhotoPreviewModal,
  WelcomeScreen,
} from "@/components/wedding-album/wedding-album-app";
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
