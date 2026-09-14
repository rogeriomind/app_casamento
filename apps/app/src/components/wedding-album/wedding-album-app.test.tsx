import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoFeedCard } from "@/components/gallery/photo-feed-card";

const videoUploadClientMock = vi.hoisted(() => ({
  createBunnyTusUploadController: vi.fn(),
  readVideoDurationSeconds: vi.fn(),
}));

vi.mock("@/lib/video-upload-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/video-upload-client")>(
      "@/lib/video-upload-client",
    );

  return {
    ...actual,
    createBunnyTusUploadController:
      videoUploadClientMock.createBunnyTusUploadController,
    readVideoDurationSeconds: videoUploadClientMock.readVideoDurationSeconds,
  };
});

import {
  GalleryScreen,
  PhotoGridButton,
  PhotoPreviewModal,
  WeddingAlbumApp,
  WelcomeScreen,
} from "@/components/wedding-album/wedding-album-app";
import { getGalleryViewStorageKey } from "@/hooks/use-gallery-view-mode";
import {
  getDeviceStorageKey,
  saveGuestSession,
} from "@/lib/session-storage";
import type { PublicEvent, PublicPhoto } from "@/types";

function photo(overrides: Partial<PublicPhoto> = {}): PublicPhoto {
  return {
    id: "photo-1",
    mediaType: "image",
    imageUrl: "https://cdn.example.com/photos/original.jpg",
    thumbnailUrl: "https://cdn.example.com/thumbnails/thumb.webp",
    videoEmbedUrl: null,
    playbackUrl: null,
    durationSeconds: null,
    width: null,
    height: null,
    guestName: "Maria",
    tags: [],
    likeCount: 2,
    isLiked: false,
    canDelete: false,
    createdAt: "2026-07-25T12:00:00.000Z",
    ...overrides,
  };
}

function videoPhoto(overrides: Partial<PublicPhoto> = {}): PublicPhoto {
  return photo({
    id: "video-1",
    mediaType: "video",
    imageUrl: null,
    thumbnailUrl: "https://vz-example.b-cdn.net/video-guid/thumbnail.jpg",
    videoEmbedUrl: "https://player.mediadelivery.net/embed/123456/video-guid",
    playbackUrl: "https://player.mediadelivery.net/play/123456/video-guid",
    durationSeconds: 42,
    width: 1920,
    height: 1080,
    ...overrides,
  });
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
      notice={null}
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
  videoUploadClientMock.readVideoDurationSeconds.mockReset();
  videoUploadClientMock.readVideoDurationSeconds.mockResolvedValue(4);
  videoUploadClientMock.createBunnyTusUploadController.mockReset();
  videoUploadClientMock.createBunnyTusUploadController.mockImplementation(
    ({
      onProgress,
      onSuccess,
    }: {
      onProgress: (progress: number) => void;
      onSuccess: () => void;
    }) => ({
      start: async () => {
        onProgress(94);
        onSuccess();
      },
      cancel: async () => undefined,
      cleanup: vi.fn(),
    }),
  );
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

  it("renders video thumbnails in the grid without loading a player", () => {
    const { container } = render(
      <PhotoGridButton
        photo={videoPhoto()}
        galleryScope="all"
        isHighlighted={false}
        isDeleting={false}
        isPriority
        onDeletePhoto={vi.fn()}
        onSelectPhoto={vi.fn()}
        onToggleLike={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Video enviada por Maria")).toHaveAttribute(
      "src",
      "https://vz-example.b-cdn.net/video-guid/thumbnail.jpg",
    );
    expect(screen.getByText("0:42")).toBeVisible();
    expect(container.querySelector("video")).not.toBeInTheDocument();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("renders the Bunny player for videos only inside the modal", () => {
    render(
      <PhotoPreviewModal
        photo={videoPhoto()}
        onToggleLike={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Video enviado por Maria")).toHaveAttribute(
      "src",
      "https://player.mediadelivery.net/embed/123456/video-guid",
    );
    expect(screen.queryByRole("link", { name: /baixar foto/i })).not.toBeInTheDocument();
  });
});

describe("wedding album upload flow", () => {
  it("refreshes a stored guest session before starting a video upload", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:video-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    window.localStorage.setItem(getDeviceStorageKey(), "device-1");
    saveGuestSession(event.id, {
      guestSessionId: "stale-session",
      guestName: "Maria",
    });

    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        void init;
        const url =
          typeof input === "string"
            ? input
            : input instanceof Request
              ? input.url
              : input.toString();

        if (url.endsWith("/presence")) {
          return new Response("{}", { status: 200 });
        }

        if (url.includes("/photos?")) {
          return Response.json({
            items: [],
            page: 1,
            limit: 16,
            hasNextPage: false,
            nextCursor: null,
          });
        }

        if (url.endsWith("/guest-sessions")) {
          return Response.json(
            {
              guestSessionId: "fresh-session",
              guestName: "Maria",
            },
            { status: 201 },
          );
        }

        if (url.endsWith("/videos/init")) {
          return Response.json(
            {
              photoId: "photo-video-1",
              status: "uploading",
              streamVideoId: "video-guid",
              tus: {
                endpoint: "https://video.bunnycdn.com/tusupload",
                headers: {
                  AuthorizationSignature: "signed",
                  AuthorizationExpire: "1800000000",
                  LibraryId: "123456",
                  VideoId: "video-guid",
                },
                metadata: {
                  filetype: "video/mp4",
                  title: "event-1 - cerimonia.mp4",
                },
              },
            },
            { status: 201 },
          );
        }

        return new Response("{}", { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeddingAlbumApp
        event={event}
        initialGallery={{
          items: [],
          page: 1,
          limit: 16,
          hasNextPage: false,
          nextCursor: null,
        }}
      />,
    );

    await screen.findByRole("button", { name: "Adicionar" });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.change(screen.getByLabelText("Gravar video"), {
      target: {
        files: [
          new File(["video"], "cerimonia.mp4", {
            type: "video/mp4",
          }),
        ],
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Publicar video" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).endsWith("/videos/init"),
        ),
      ).toBe(true);
    });

    const sessionCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/guest-sessions"),
    );
    const initCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/videos/init"),
    );
    const sessionRequest = sessionCall?.[1] as RequestInit;
    const initRequest = initCall?.[1] as RequestInit;

    expect(sessionRequest.headers).toMatchObject({
      "x-device-id": "device-1",
    });
    expect(JSON.parse(String(sessionRequest.body))).toEqual({
      guestName: "Maria",
    });
    expect(JSON.parse(String(initRequest.body))).toMatchObject({
      guestSessionId: "fresh-session",
    });
    expect(JSON.stringify(initRequest.body)).not.toContain("stale-session");
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
