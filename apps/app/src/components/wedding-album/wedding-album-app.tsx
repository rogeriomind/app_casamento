"use client";

import {
  AlertCircle,
  Camera,
  Check,
  Lightbulb,
  Heart,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Download,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  User,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { GalleryLoadMoreSentinel } from "@/components/gallery/gallery-load-more-sentinel";
import { GalleryViewToggle } from "@/components/gallery/gallery-view-toggle";
import { PhotoFeed } from "@/components/gallery/photo-feed";
import { PhotoGrid } from "@/components/gallery/photo-grid";
import { PhotoGridCard } from "@/components/gallery/photo-grid-card";
import { useEventPresence } from "@/hooks/use-event-presence";
import {
  prependGalleryPhoto,
  removeGalleryPhoto,
  replaceGalleryPhoto,
  useGalleryPagination,
} from "@/hooks/use-gallery-pagination";
import { useGalleryViewMode } from "@/hooks/use-gallery-view-mode";
import { useGuestSession } from "@/hooks/use-guest-session";
import { usePhotoLikes } from "@/hooks/use-photo-likes";
import {
  type UploadFileSelection,
  type UploadItem,
  usePhotoUploadQueue,
} from "@/hooks/use-photo-upload-queue";
import {
  MAX_PHOTO_TAGS,
  POPULAR_TAGS,
  normalizePhotoTags,
  normalizeTag,
} from "@/lib/photo-tags";
import {
  MAX_VIDEO_DURATION_SECONDS,
  guestNameSchema,
  normalizeGuestName,
  validateImageFileInput,
  validateVideoFileInput,
} from "@/lib/validators";
import { readVideoDurationSeconds } from "@/lib/video-upload-client";
import type {
  ApiError,
  GalleryViewMode,
  PaginatedPhotos,
  PublicEvent,
  PublicPhoto,
} from "@/types";
import flowerBase from "../../../public/assets/welcome-flor.webp";
import flowerDecoration from "../../../public/assets/welcome-flor2.webp";
import coupleIllustration from "../../../public/assets/welcome-nos.webp";

type Step = "welcome" | "name" | "gallery" | "tagging" | "success" | "account";
type NameBackTarget = "welcome" | "account";
type GalleryScope = "all" | "mine";

type PendingUpload = UploadItem;

const MAX_GALLERY_UPLOADS = 10;
const COUPLE_ILLUSTRATION_BLUR_DATA_URL =
  "data:image/webp;base64,UklGRg4BAABXRUJQVlA4WAoAAAAQAAAADwAACgAAQUxQSHkAAAABcFtt23O8///LVFmZU5d7xwJWMEHO7MAKJtAZIHUG0KlUOWce+Z0hIiaAvi2tbk1G3DaAvMzP6AAIlzFO/mkCcI+AS5SIhFhjBaxKAFAn0g3AnQlUBPsg0pD3UOsn0+VqfwFwv98BhyTJdHK1qRh3W422VCJAfFEgAFZQOCBuAAAAMAIAnQEqEAALAAPAYCWUAuwGLkcFYr/edEAA/uc5sInHaSTS5YiByKd500Bf+95mNJefBPxx9zSuFjQhUvh78qPU0ceSdX0hhE7Yyj32yvk9rvqsL5gxLb6qcO9+oYI0oVf4/j2T0McPL8wAAAA=";

function photoMatchesTag(photo: PublicPhoto, normalizedTagSearch: string) {
  return photo.tags.some((tag) => normalizeTag(tag).includes(normalizedTagSearch));
}

function getSelectedMediaType(file: File): PendingUpload["mediaType"] | null {
  const mimeType = file.type.toLowerCase();
  const imageValidation = validateImageFileInput(file);
  const videoValidation = validateVideoFileInput(file);

  if (mimeType.startsWith("video/") || (videoValidation.ok && !imageValidation.ok)) {
    return "video";
  }

  if (mimeType.startsWith("image/") || imageValidation.ok) {
    return "image";
  }

  return null;
}

function formatUploadStatus(status: PendingUpload["status"]) {
  switch (status) {
    case "waiting":
      return "Aguardando";
    case "preparing":
      return "Preparando";
    case "uploading":
      return "Enviando";
    case "processing":
      return "Processando";
    case "success":
      return "Publicado";
    case "error":
      return "Erro";
    case "cancelled":
      return "Cancelado";
  }
}

type WeddingAlbumAppProps = {
  event: PublicEvent;
  initialGallery: PaginatedPhotos;
};

function stepReducer(_current: Step, next: Step) {
  return next;
}

export function WeddingAlbumApp({ event, initialGallery }: WeddingAlbumAppProps) {
  const [step, dispatchStep] = useReducer(stepReducer, "welcome");
  const setStep = useCallback((next: Step) => dispatchStep(next), []);
  const [nameBackTarget, setNameBackTarget] =
    useState<NameBackTarget>("welcome");
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [successPhoto, setSuccessPhoto] = useState<PublicPhoto | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);
  const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(
    null,
  );
  const cameraInputId = `${event.id}-camera-input`;
  const videoInputId = `${event.id}-video-input`;
  const galleryInputId = `${event.id}-gallery-input`;
  const { session, deviceId, isHydrated, submitGuestName, signOut } =
    useGuestSession(event.id);
  const guestSessionId = session?.guestSessionId ?? null;
  const {
    photos,
    setPhotos,
    isLoading: isGalleryLoading,
    isLoadingMore,
    hasNextPage,
    initialError: galleryError,
    loadMoreError,
    sentinelRef,
    loadMore: loadMorePhotos,
    retry: retryGallery,
  } = useGalleryPagination({
    eventId: event.id,
    guestSessionId,
    initialGallery,
  });

  useEffect(() => {
    if (isHydrated && session) {
      setStep("gallery");
    }
  }, [isHydrated, session, setStep]);

  useEventPresence({
    eventId: event.id,
    session,
    deviceId,
    enabled: step === "gallery",
  });

  const handlePublishedPhoto = useCallback(
    (photo: PublicPhoto) => {
      setPhotos((current) => prependGalleryPhoto(current, photo));
      setSuccessPhoto((current) => current ?? photo);
      setHighlightedPhotoId(photo.id);
    },
    [setPhotos],
  );
  const uploadQueue = usePhotoUploadQueue({
    eventId: event.id,
    onPhotoPublished: handlePublishedPhoto,
  });

  useEffect(() => {
    if (!highlightedPhotoId) {
      return;
    }

    const timeout = window.setTimeout(() => setHighlightedPhotoId(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [highlightedPhotoId]);

  async function handleGuestNameSubmit(guestName: string) {
    await submitGuestName(guestName);
    setStep("gallery");
  }

  const applyPhotoUpdate = useCallback(
    (nextPhoto: PublicPhoto) => {
      setPhotos((current) => replaceGalleryPhoto(current, nextPhoto));
      setSelectedPhoto((current) =>
        current?.id === nextPhoto.id ? nextPhoto : current,
      );
      setSuccessPhoto((current) =>
        current?.id === nextPhoto.id ? nextPhoto : current,
      );
    },
    [setPhotos],
  );
  const { togglePhotoLike } = usePhotoLikes({
    eventId: event.id,
    session,
    onPhotoUpdate: applyPhotoUpdate,
    onError: setUploadError,
    requireSession: () => setStep("name"),
  });

  const deletePhoto = useCallback(async (photo: PublicPhoto) => {
    if (!session) {
      setNameBackTarget("welcome");
      setStep("name");
      return;
    }

    const confirmed = window.confirm(
      photo.mediaType === "video" ? "Excluir este video?" : "Excluir esta foto?",
    );
    if (!confirmed) {
      return;
    }

    setUploadError(null);
    setDeletingPhotoIds((current) => new Set(current).add(photo.id));

    try {
      const response = await fetch(
        `/api/events/${event.id}/photos/${photo.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestSessionId: session.guestSessionId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setPhotos((current) => removeGalleryPhoto(current, photo.id));
      setSelectedPhoto((current) => (current?.id === photo.id ? null : current));
      setSuccessPhoto((current) => (current?.id === photo.id ? null : current));
    } catch (error) {
      setUploadNotice(null);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel excluir a midia.",
      );
    } finally {
      setDeletingPhotoIds((current) => {
        const next = new Set(current);
        next.delete(photo.id);
        return next;
      });
    }
  }, [event.id, session, setPhotos, setStep]);

  const handleAddPhoto = useCallback(() => setIsSheetOpen(true), []);
  const handleDeletePhoto = useCallback(
    (photo: PublicPhoto) => void deletePhoto(photo),
    [deletePhoto],
  );
  const handleOpenAccount = useCallback(() => setStep("account"), [setStep]);
  const handleSelectPhoto = useCallback((photo: PublicPhoto) => {
    setSelectedPhoto(photo);
  }, []);
  const handleTogglePhotoLike = useCallback(
    (photo: PublicPhoto) => void togglePhotoLike(photo),
    [togglePhotoLike],
  );

  async function uploadPendingPhotos(tags: string[]) {
    if (uploadQueue.items.length === 0) {
      setStep("gallery");
      return;
    }

    if (!session) {
      setStep("name");
      return;
    }

    setUploadError(null);
    setUploadNotice(null);
    setIsSheetOpen(false);

    try {
      const activeSession = await submitGuestName(session.guestName);
      const summary = await uploadQueue.start(activeSession.guestSessionId, tags);
      if (summary.successCount === 0) {
        setUploadError(
          summary.errorCount > 0
            ? "Nao foi possivel publicar as fotos agora."
            : "Nenhuma foto foi publicada.",
        );
        return;
      }

      if (summary.errorCount > 0 || summary.cancelledCount > 0) {
        setUploadError(
          `${summary.successCount} fotos publicadas, ${summary.errorCount + summary.cancelledCount} pendentes.`,
        );
        setStep("tagging");
        return;
      }

      const uploadedVideoCount = uploadQueue.items.filter(
        (item) => item.mediaType === "video",
      ).length;
      uploadQueue.clear();
      if (summary.successCount === 1 && summary.firstPhoto) {
        setSuccessPhoto(summary.firstPhoto);
        setStep("success");
        return;
      }

      if (uploadedVideoCount > 0) {
        setUploadNotice(
          "Video enviado. Ele aparecera na galeria apos o processamento.",
        );
      }
      setStep("gallery");
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel publicar as fotos agora.",
      );
    }
  }

  async function retryPendingUpload(itemId: string, tags: string[]) {
    if (!session) {
      setStep("name");
      return;
    }

    setUploadError(null);

    try {
      const activeSession = await submitGuestName(session.guestName);
      await uploadQueue.start(activeSession.guestSessionId, tags, itemId);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel publicar as fotos agora.",
      );
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const isGalleryInput = event.currentTarget.id === galleryInputId;
    const isVideoInput = event.currentTarget.id === videoInputId;
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const selectedFiles =
      isGalleryInput && !isVideoInput ? files : files.slice(0, 1);
    const selectedMediaTypes = selectedFiles.map(getSelectedMediaType);
    const hasVideo = selectedMediaTypes.includes("video");
    const hasImage = selectedMediaTypes.includes("image");

    if (selectedMediaTypes.some((mediaType) => mediaType === null)) {
      setIsSheetOpen(false);
      setUploadNotice(null);
      setUploadError("Selecione fotos ou um video MP4, MOV ou WebM.");
      return;
    }

    if (hasVideo && (hasImage || selectedFiles.length > 1)) {
      setIsSheetOpen(false);
      setUploadNotice(null);
      setUploadError("Selecione ate 10 fotos ou apenas 1 video por vez.");
      return;
    }

    if (!hasVideo && isGalleryInput && selectedFiles.length > MAX_GALLERY_UPLOADS) {
      setIsSheetOpen(false);
      setUploadNotice(null);
      setUploadError(`Selecione ate ${MAX_GALLERY_UPLOADS} fotos por vez.`);
      return;
    }

    if (!session) {
      setStep("name");
      return;
    }

    const uploadSelections: UploadFileSelection[] = [];

    for (const [index, file] of selectedFiles.entries()) {
      const mediaType = selectedMediaTypes[index];
      if (mediaType === "video") {
        const durationSeconds = await readVideoDurationSeconds(file);
        const validation = validateVideoFileInput({
          name: file.name,
          type: file.type,
          size: file.size,
          durationSeconds,
        });

        if (!validation.ok) {
          setIsSheetOpen(false);
          setUploadNotice(null);
          setUploadError(
            `${file.name || "Um video"}: ${validation.message}`,
          );
          return;
        }

        uploadSelections.push({ file, mediaType, durationSeconds });
        continue;
      }

      const validation = validateImageFileInput(file);
      if (!validation.ok) {
        setIsSheetOpen(false);
        setUploadNotice(null);
        setUploadError(
          `${file.name || "Uma foto"}: ${validation.message}`,
        );
        return;
      }

      uploadSelections.push({ file, mediaType: "image" as const });
    }

    setUploadError(null);
    setUploadNotice(null);
    setIsSheetOpen(false);
    uploadQueue.setFiles(uploadSelections);
    setStep("tagging");
  }

  function handleCancelTagging() {
    uploadQueue.clear();
    setStep("gallery");
  }

  function handleSeeGallery() {
    if (successPhoto) {
      setHighlightedPhotoId(successPhoto.id);
    }
    setStep("gallery");
  }

  function handleStartName() {
    setNameBackTarget("welcome");
    setStep("name");
  }

  function handleNameBack() {
    if (nameBackTarget === "account" && session) {
      setStep("account");
      return;
    }

    setStep("welcome");
  }

  function handleEditGuestName() {
    setNameBackTarget("account");
    setStep("name");
  }

  function handleSignOut() {
    signOut();
    setSelectedPhoto(null);
    setSuccessPhoto(null);
    setIsSheetOpen(false);
    setUploadError(null);
    setUploadNotice(null);
    uploadQueue.clear();
    setPhotos((current) =>
      current.map((photo) => ({
        ...photo,
        isLiked: false,
      })),
    );
    setStep("welcome");
  }

  return (
    <AppShell>
      <input
        id={cameraInputId}
        className="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Tirar foto"
        tabIndex={-1}
        onChange={(event) => void handleFileChange(event)}
      />
      <input
        id={videoInputId}
        className="hidden-input"
        type="file"
        accept="video/*"
        capture="environment"
        aria-label="Gravar video"
        tabIndex={-1}
        onChange={(event) => void handleFileChange(event)}
      />
      <input
        id={galleryInputId}
        className="hidden-input"
        type="file"
        accept="image/*,video/*"
        multiple
        aria-label="Enviar da galeria"
        tabIndex={-1}
        onChange={(event) => void handleFileChange(event)}
      />

      {step === "welcome" && (
        <WelcomeScreen
          event={event}
          isReady={isHydrated}
          onStart={handleStartName}
        />
      )}

      {step === "name" && (
        <NameScreen
          defaultName={session?.guestName ?? ""}
          event={event}
          onBack={handleNameBack}
          onSubmit={handleGuestNameSubmit}
        />
      )}

      {step === "gallery" && (
        <GalleryScreen
          event={event}
          photos={photos}
          guestName={session?.guestName}
          highlightedPhotoId={highlightedPhotoId}
          isGalleryLoading={isGalleryLoading}
          isLoadingMore={isLoadingMore}
          hasNextPage={hasNextPage}
          isUploading={uploadQueue.isUploading}
          deletingPhotoIds={deletingPhotoIds}
          error={galleryError ?? uploadError}
          notice={uploadNotice}
          loadMoreError={loadMoreError}
          sentinelRef={sentinelRef}
          onAddPhoto={handleAddPhoto}
          onDeletePhoto={handleDeletePhoto}
          onLoadMore={loadMorePhotos}
          onOpenAccount={handleOpenAccount}
          onSelectPhoto={handleSelectPhoto}
          onToggleLike={handleTogglePhotoLike}
          onRetry={retryGallery}
        />
      )}

      {step === "account" && (
        <AccountScreen
          event={event}
          guestName={session?.guestName}
          onClose={() => setStep("gallery")}
          onEditName={handleEditGuestName}
          onSignOut={handleSignOut}
        />
      )}

      {step === "tagging" && uploadQueue.items.length > 0 && (
        <TagConfirmationScreen
          pendingUploads={uploadQueue.items}
          isUploading={uploadQueue.isUploading}
          onCancelUpload={uploadQueue.cancelItem}
          onCancel={handleCancelTagging}
          onPublish={(tags) => void uploadPendingPhotos(tags)}
          onRetry={(itemId, tags) => void retryPendingUpload(itemId, tags)}
        />
      )}

      {step === "success" && successPhoto && (
        <SuccessScreen photo={successPhoto} onSeeGallery={handleSeeGallery} />
      )}

      <AddPhotoSheet
        isOpen={isSheetOpen}
        isUploading={uploadQueue.isUploading}
        cameraInputId={cameraInputId}
        videoInputId={videoInputId}
        galleryInputId={galleryInputId}
        onClose={() => setIsSheetOpen(false)}
      />

      <PhotoPreviewModal
        photo={selectedPhoto}
        onToggleLike={(photo) => void togglePhotoLike(photo)}
        onClose={() => setSelectedPhoto(null)}
      />
    </AppShell>
  );
}

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  return data?.error ?? "Algo nao saiu como esperado.";
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-stage">
      <section className="mobile-shell">{children}</section>
    </main>
  );
}

export function WelcomeScreen({
  event,
  isReady,
  onStart,
}: {
  event: PublicEvent;
  isReady: boolean;
  onStart: () => void;
}) {
  return (
    <div className="screen welcome-screen">
      <Image
        className="flower-corner left"
        src={flowerDecoration}
        alt=""
        width={300}
        height={315}
        aria-hidden="true"
        sizes="150px"
        loading="eager"
        unoptimized
      />
      <Image
        className="flower-corner right"
        src={flowerDecoration}
        alt=""
        width={300}
        height={315}
        aria-hidden="true"
        sizes="150px"
        loading="eager"
        unoptimized
      />

      <div className="welcome-copy">
        <p className="couple-name">{event.coupleName}</p>
        <h1>Bem-vindo ao album do casamento</h1>
        <p>Estamos muito felizes que voce esteja aqui!</p>
        <p>Compartilhe os melhores momentos deste dia especial conosco.</p>
      </div>

      <div className="couple-illustration-wrap">
        <Image
          className="couple-illustration"
          src={coupleIllustration}
          alt="Ilustracao dos noivos"
          width={820}
          height={547}
          sizes="(max-width: 430px) 84vw, 361px"
          loading="eager"
          fetchPriority="high"
          placeholder="blur"
          blurDataURL={COUPLE_ILLUSTRATION_BLUR_DATA_URL}
          unoptimized
        />
        <Image
          className="flower-base"
          src={flowerBase}
          alt=""
          width={1160}
          height={773}
          aria-hidden="true"
          sizes="(max-width: 430px) 135vw, 580px"
          loading="eager"
          fetchPriority="high"
          unoptimized
        />
      </div>

      <button
        className="primary-button"
        type="button"
        disabled={!isReady}
        onClick={onStart}
      >
        Comecar
      </button>
    </div>
  );
}

export function NameScreen({
  defaultName,
  event,
  onBack,
  onSubmit,
}: {
  defaultName: string;
  event: PublicEvent;
  onBack: () => void;
  onSubmit: (guestName: string) => Promise<void>;
}) {
  const [guestName, setGuestName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameResult = useMemo(
    () => guestNameSchema.safeParse(guestName),
    [guestName],
  );

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const parsedName = guestNameSchema.safeParse(guestName);

    if (!parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? "Nome invalido.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(parsedName.data);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nao foi possivel salvar seu nome.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="screen name-screen">
      <button
        className="icon-button back-button"
        type="button"
        onClick={onBack}
        aria-label="Voltar"
      >
        <X aria-hidden="true" />
      </button>

      <div className="name-card">
        <p className="monogram">{event.monogram}</p>
        <img className="small-flower" src="/assets/flor2.png" alt="" />
        <h1>Para comecar, digite seu nome</h1>
        <p>Assim todos saberao quem compartilhou cada momento.</p>

        <form onSubmit={handleSubmit} className="name-form">
          <label className="input-row">
            <User aria-hidden="true" />
            <input
              autoComplete="name"
              inputMode="text"
              placeholder="Digite seu nome"
              value={guestName}
              onChange={(event) => {
                setGuestName(event.target.value);
                setError(null);
              }}
            />
          </label>

          {error && <InlineAlert message={error} />}

          <button
            className="primary-button"
            type="submit"
            disabled={!nameResult.success || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="spin-icon small" />
                Entrando
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>

      <p className="secure-note">
        <ShieldCheck aria-hidden="true" />
        Seus dados estao seguros
      </p>
      <img className="name-flower bottom-left" src="/assets/flor2.png" alt="" />
      <img className="name-flower bottom-right" src="/assets/flor2.png" alt="" />
    </div>
  );
}

export function TagConfirmationScreen({
  pendingUploads,
  isUploading,
  onCancelUpload,
  onCancel,
  onPublish,
  onRetry,
}: {
  pendingUploads: PendingUpload[];
  isUploading: boolean;
  onCancelUpload: (itemId: string) => void;
  onCancel: () => void;
  onPublish: (tags: string[]) => void;
  onRetry: (itemId: string, tags: string[]) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const uploadCount = pendingUploads.length;
  const isMultiple = uploadCount > 1;
  const hasVideo = pendingUploads.some((upload) => upload.mediaType === "video");
  const mediaLabel = hasVideo ? "video" : "foto";
  const selectedCountLabel = hasVideo
    ? "1 video selecionado"
    : `${uploadCount} ${
        uploadCount === 1 ? "foto selecionada" : "fotos selecionadas"
      }`;

  function addTag(value: string) {
    const tags = normalizePhotoTags(value.split(/[,\s]+/));

    if (tags.length === 0) {
      setTagInput("");
      return;
    }

    setSelectedTags((current) => normalizePhotoTags([...current, ...tags]));
    setTagInput("");
  }

  function togglePopularTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      if (current.length >= MAX_PHOTO_TAGS) {
        return current;
      }

      return [...current, tag];
    });
  }

  return (
    <div className="screen tag-confirm-screen">
      <button
        className="icon-button tag-close-button"
        type="button"
        onClick={onCancel}
        aria-label="Cancelar publicacao"
        disabled={isUploading}
      >
        <X aria-hidden="true" />
      </button>

      <header className="tag-confirm-header">
        <h1>Adicionar tags</h1>
        <p>
          {hasVideo
            ? "Adicione tags que descrevem este video."
            : isMultiple
            ? "Adicione tags que descrevem estas fotos."
            : "Adicione tags que descrevem esta foto."}
        </p>
      </header>

      <div className={`tag-preview-card ${isMultiple ? "multiple" : ""}`}>
        <div className="tag-preview-grid">
          {pendingUploads.map((upload, index) => (
            <div className="tag-preview-item" key={upload.id}>
              {upload.mediaType === "video" ? (
                <div className="tag-video-preview">
                  <Video aria-hidden="true" />
                  <span>{upload.file.name || `Video ${index + 1}`}</span>
                  {upload.durationSeconds ? (
                    <small>{Math.ceil(upload.durationSeconds)}s</small>
                  ) : null}
                </div>
              ) : (
                <img
                  src={upload.previewUrl}
                  alt={`Pre-visualizacao da foto ${index + 1}`}
                />
              )}
              <div className="upload-preview-status">
                <span>{formatUploadStatus(upload.status)}</span>
                <progress value={upload.progress} max={100} />
                {upload.error && <small>{upload.error}</small>}
                {upload.status === "error" && (
                  <button
                    type="button"
                    onClick={() => onRetry(upload.id, selectedTags)}
                    disabled={isUploading}
                  >
                    Tentar novamente
                  </button>
                )}
                {["waiting", "preparing", "uploading", "processing"].includes(
                  upload.status,
                ) && (
                  <button
                    type="button"
                    onClick={() => onCancelUpload(upload.id)}
                    disabled={upload.status === "success"}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <span className="tag-photo-count">
          {selectedCountLabel}
        </span>
        <p>
          <Tag aria-hidden="true" />
          {hasVideo
            ? "As tags serao aplicadas ao video selecionado."
            : isMultiple
            ? "As tags serao aplicadas em todas as fotos selecionadas."
            : "Adicione tags para ajudar seus convidados a encontrar esta foto."}
        </p>
      </div>

      <section className="tag-editor" aria-label="Adicionar tags">
        <div className="tag-editor-heading">
          <h2>Adicionar tags</h2>
          <span>
            {selectedTags.length}/{MAX_PHOTO_TAGS}
          </span>
        </div>

        <div className="tag-entry-field">
          <span>#</span>
          <input
            value={tagInput}
            aria-label="Nova tag"
            placeholder="Ex.: #noivos, #festa, #pista"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag(tagInput);
              }
            }}
          />
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            disabled={isUploading || selectedTags.length >= MAX_PHOTO_TAGS}
            aria-label="Adicionar tag"
          >
            <Plus aria-hidden="true" />
          </button>
        </div>

        {selectedTags.length > 0 && (
          <div className="selected-tag-row" aria-label="Tags selecionadas">
            {selectedTags.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() =>
                  setSelectedTags((current) =>
                    current.filter((item) => item !== tag),
                  )
                }
                disabled={isUploading}
              >
                #{tag}
                <X aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <p className="tag-helper">
          Digite e pressione enter ou toque no + para adicionar.
        </p>

        <h3>Tags populares</h3>
        <div className="popular-tag-row">
          {POPULAR_TAGS.map((tag) => (
            <button
              className={selectedTags.includes(tag) ? "active" : ""}
              type="button"
              key={tag}
              onClick={() => togglePopularTag(tag)}
              disabled={isUploading}
            >
              #{tag}
            </button>
          ))}
        </div>

        <p className="tag-tip">
          <Lightbulb aria-hidden="true" />
          Use tags para tornar seu {mediaLabel} mais facil de encontrar.
        </p>

        <button
          className="primary-button publish-photo-button"
          type="button"
          onClick={() => onPublish(selectedTags)}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 aria-hidden="true" className="spin-icon small" />
              Publicando
            </>
          ) : hasVideo ? (
            "Publicar video"
          ) : isMultiple ? (
            "Publicar fotos"
          ) : (
            "Publicar foto"
          )}
        </button>
      </section>
    </div>
  );
}

export function GalleryScreen({
  event,
  photos,
  guestName,
  highlightedPhotoId,
  isGalleryLoading,
  isLoadingMore,
  hasNextPage,
  isUploading,
  deletingPhotoIds,
  error,
  notice,
  loadMoreError,
  sentinelRef,
  onAddPhoto,
  onDeletePhoto,
  onLoadMore,
  onOpenAccount,
  onSelectPhoto,
  onToggleLike,
  onRetry,
}: {
  event: PublicEvent;
  photos: PublicPhoto[];
  guestName?: string;
  highlightedPhotoId: string | null;
  isGalleryLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  isUploading: boolean;
  deletingPhotoIds: Set<string>;
  error: string | null;
  notice: string | null;
  loadMoreError: string | null;
  sentinelRef: React.RefCallback<HTMLDivElement>;
  onAddPhoto: () => void;
  onDeletePhoto: (photo: PublicPhoto) => void;
  onLoadMore: () => void;
  onOpenAccount: () => void;
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
  onRetry: () => void;
}) {
  const [galleryScope, setGalleryScope] = useState<GalleryScope>("mine");
  const [tagSearch, setTagSearch] = useState("");
  const deferredTagSearch = useDeferredValue(tagSearch);
  const { viewMode, setViewMode } = useGalleryViewMode(event.id);
  const normalizedGuestName = guestName
    ? normalizeGuestName(guestName).toLocaleLowerCase("pt-BR")
    : "";
  const myPhotos = useMemo(
    () =>
      photos.filter(
        (photo) =>
          normalizeGuestName(photo.guestName).toLocaleLowerCase("pt-BR") ===
          normalizedGuestName,
    ),
    [normalizedGuestName, photos],
  );
  const normalizedTagSearch = normalizeTag(deferredTagSearch);
  const normalizedCurrentTagSearch = normalizeTag(tagSearch);
  const filteredAllPhotos = useMemo(() => {
    if (!normalizedTagSearch) {
      return photos;
    }

    return photos.filter((photo) => photoMatchesTag(photo, normalizedTagSearch));
  }, [normalizedTagSearch, photos]);
  const visiblePhotos =
    galleryScope === "mine" ? myPhotos : filteredAllPhotos;
  const effectiveViewMode: GalleryViewMode =
    galleryScope === "all" ? viewMode : "grid";
  const showLoadMoreButton = hasNextPage;
  const galleryTitle = galleryScope === "mine" ? "Minhas fotos" : "Galeria";
  const emptyTitle =
    galleryScope === "mine"
      ? "Voce ainda nao enviou fotos"
      : normalizedTagSearch
        ? `Nenhuma foto encontrada para #${normalizedTagSearch}`
        : "Seja a primeira pessoa a enviar uma foto";
  const emptyDescription =
    galleryScope === "mine"
      ? `As fotos enviadas com o nome ${guestName ?? "atual"} aparecerao aqui.`
      : normalizedTagSearch
        ? "Tente outra tag ou limpe a busca."
        : "Os momentos compartilhados aparecerao aqui.";

  return (
    <div className="screen gallery-screen">
      <header className="gallery-header">
        <div>
          <p className="gallery-title">{galleryTitle}</p>
          <p className="gallery-monogram">{event.monogram}</p>
        </div>
        {galleryScope === "all" && (
          <GalleryViewToggle value={viewMode} onChange={setViewMode} />
        )}
      </header>

      {galleryScope === "all" && (
        <div className="tag-search-panel">
          <label className="tag-search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              inputMode="search"
              placeholder="Procurar por tags"
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
            />
          </label>

          <div className="tag-chip-row" aria-label="Tags populares">
            <button
              className={!normalizedCurrentTagSearch ? "active" : ""}
              type="button"
              onClick={() => setTagSearch("")}
            >
              Todas
            </button>
            {POPULAR_TAGS.map((tag) => {
              const isActive = normalizedCurrentTagSearch === tag;

              return (
                <button
                  className={isActive ? "active" : ""}
                  type="button"
                  key={tag}
                  onClick={() => setTagSearch(isActive ? "" : tag)}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          <section className="gallery-usage-card" aria-label="Como interagir com as fotos">
            <div className="gallery-usage-icon">
              <Lightbulb aria-hidden="true" />
            </div>
            <div className="gallery-usage-content">
              <p>Como interagir com as fotos</p>
              <div className="gallery-usage-actions">
                <div className="gallery-usage-action">
                  <span className="usage-pill">2s</span>
                  <div>
                    <strong>Segure por 2 segundos</strong>
                    <small>para abrir a foto</small>
                  </div>
                </div>
                <div className="gallery-usage-divider" />
                <div className="gallery-usage-action">
                  <span className="usage-heart">
                    <Heart aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Toque duas vezes</strong>
                    <small>na foto para curtir</small>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {error && (
        <div className="gallery-alert">
          <InlineAlert message={error} />
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {isGalleryLoading && photos.length === 0 ? (
        <GallerySkeleton />
      ) : visiblePhotos.length > 0 ? (
        <>
          {effectiveViewMode === "feed" ? (
            <PhotoFeed
              photos={visiblePhotos}
              onSelectPhoto={onSelectPhoto}
              onToggleLike={onToggleLike}
            />
          ) : (
            <PhotoGrid
              photos={visiblePhotos}
              galleryScope={galleryScope}
              highlightedPhotoId={highlightedPhotoId}
              deletingPhotoIds={deletingPhotoIds}
              onDeletePhoto={onDeletePhoto}
              onSelectPhoto={onSelectPhoto}
              onToggleLike={onToggleLike}
            />
          )}
          <GalleryLoadMoreSentinel
            sentinelRef={sentinelRef}
            hasNextPage={hasNextPage}
            isLoadingMore={isLoadingMore}
            loadMoreError={loadMoreError}
            showLoadMoreButton={showLoadMoreButton}
            onLoadMore={onLoadMore}
          />
          {isLoadingMore && effectiveViewMode === "grid" && (
            <GallerySkeleton count={6} />
          )}
          {isLoadingMore && effectiveViewMode === "feed" && (
            <p className="photo-feed-loading" role="status">
              <Loader2 aria-hidden="true" className="spin-icon small" />
              Carregando fotos
            </p>
          )}
          {!hasNextPage && galleryScope === "all" && (
            <p className="gallery-end-message">Todas as fotos foram carregadas.</p>
          )}
        </>
      ) : (
        <div className="empty-gallery">
          <ImageIcon aria-hidden="true" />
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      )}

      {isUploading && (
        <div className="upload-toast" role="status">
          <Loader2 aria-hidden="true" className="spin-icon small" />
          Enviando...
        </div>
      )}
      {notice && <p className="gallery-notice">{notice}</p>}

      <button className="floating-add-button" type="button" onClick={onAddPhoto}>
        <span aria-hidden="true">+</span>
        Adicionar
      </button>

      <nav className="bottom-nav" aria-label="Navegacao">
        <button
          className={galleryScope === "mine" ? "active" : ""}
          type="button"
          onClick={() => setGalleryScope("mine")}
          aria-label="Minhas fotos"
          title="Minhas fotos"
        >
          <ImageIcon aria-hidden="true" />
        </button>
        <button
          className={galleryScope === "all" ? "active" : ""}
          type="button"
          onClick={() => setGalleryScope("all")}
          aria-label="Todas as fotos"
          title="Todas as fotos"
        >
          <Heart aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpenAccount} aria-label="Perfil">
          <User aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

export function AccountScreen({
  event,
  guestName,
  onClose,
  onEditName,
  onSignOut,
}: {
  event: PublicEvent;
  guestName?: string;
  onClose: () => void;
  onEditName: () => void;
  onSignOut: () => void;
}) {
  const displayName = guestName ?? "Convidado";
  const guestInitial =
    normalizeGuestName(displayName).charAt(0).toLocaleUpperCase("pt-BR") || "?";

  return (
    <div className="screen account-screen">
      <button
        className="icon-button account-close-button"
        type="button"
        onClick={onClose}
        aria-label="Voltar para galeria"
      >
        <X aria-hidden="true" />
      </button>

      <header className="account-header">
        <h1>Sua conta</h1>
      </header>

      <div className="account-brand" aria-hidden="true">
        <p className="monogram account-monogram">{event.monogram}</p>
        <img src="/assets/flor2.png" alt="" />
      </div>

      <section className="account-card" aria-label="Usuario atual">
        <div className="account-avatar" aria-hidden="true">
          {guestInitial}
        </div>
        <div className="account-user-copy">
          <span>Logado como</span>
          <strong>{displayName}</strong>
        </div>
        <button className="account-edit-button" type="button" onClick={onEditName}>
          <Pencil aria-hidden="true" />
          Alterar
        </button>
      </section>

      <div className="account-divider" aria-hidden="true">
        <span>
          <Heart />
        </span>
      </div>

      <button
        className="account-signout-button"
        type="button"
        onClick={onSignOut}
      >
        <LogOut aria-hidden="true" />
        Sair da conta
      </button>

      <p className="account-help">
        D&uacute;vidas? Fale com a organiza&ccedil;&atilde;o do evento.
      </p>

      <img className="account-flower bottom-left" src="/assets/flor2.png" alt="" />
      <img
        className="account-flower bottom-right"
        src="/assets/flor2.png"
        alt=""
      />
    </div>
  );
}

export const PhotoGridButton = PhotoGridCard;

export function PhotoPreviewModal({
  photo,
  onToggleLike,
  onClose,
}: {
  photo: PublicPhoto | null;
  onToggleLike: (photo: PublicPhoto) => void;
  onClose: () => void;
}) {
  if (!photo) {
    return null;
  }

  const isVideo = photo.mediaType === "video";
  const mediaLabel = isVideo ? "video" : "foto";
  const downloadName = `foto-casamento-${photo.id}.jpg`;
  const imageUrl = photo.imageUrl ?? photo.thumbnailUrl;

  return (
    <div
      className="preview-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="photo-preview"
        role="dialog"
        aria-modal="true"
        aria-label={`Pre-visualizar ${mediaLabel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="preview-header">
          <div>
            <p>{isVideo ? "Video enviado por" : "Foto enviada por"}</p>
            <strong>{photo.guestName}</strong>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar pre-visualizacao"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        {isVideo ? (
          photo.videoEmbedUrl ? (
            <iframe
              key={photo.id}
              className="preview-video-player"
              src={photo.videoEmbedUrl}
              title={`Video enviado por ${photo.guestName}`}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="preview-media-placeholder">
              <Video aria-hidden="true" />
              <span>Video indisponivel</span>
            </div>
          )
        ) : imageUrl ? (
          <img
            className="preview-photo"
            src={imageUrl}
            alt={`Foto enviada por ${photo.guestName}`}
          />
        ) : (
          <div className="preview-media-placeholder">
            <ImageIcon aria-hidden="true" />
            <span>Foto indisponivel</span>
          </div>
        )}

        <button
          className={`preview-like-button ${photo.isLiked ? "liked" : ""}`}
          type="button"
          onClick={() => onToggleLike(photo)}
          aria-label={photo.isLiked ? "Remover curtida" : `Curtir ${mediaLabel}`}
        >
          <span>
            <Heart aria-hidden="true" />
          </span>
          <strong>{photo.isLiked ? "Curtido" : "Curtir"}</strong>
          <small>{photo.likeCount}</small>
        </button>

        {!isVideo && imageUrl && (
          <a
            className="download-button"
            href={imageUrl}
            download={downloadName}
            target="_blank"
            rel="noreferrer"
          >
            <Download aria-hidden="true" />
            Baixar foto
          </a>
        )}
      </section>
    </div>
  );
}

export function GallerySkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="photo-grid skeleton-grid" aria-label="Carregando galeria">
      {Array.from({ length: count }, (_, index) => (
        <div className="photo-card skeleton-card" key={index} />
      ))}
    </div>
  );
}

export function AddPhotoSheet({
  isOpen,
  isUploading,
  cameraInputId,
  videoInputId,
  galleryInputId,
  onClose,
}: {
  isOpen: boolean;
  isUploading: boolean;
  cameraInputId: string;
  videoInputId: string;
  galleryInputId: string;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="add-photo-sheet"
        aria-label="Adicionar foto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2>Adicionar foto</h2>
        <p>Escolha como deseja compartilhar seu momento</p>

        <label
          className={`sheet-option ${isUploading ? "disabled" : ""}`}
          htmlFor={cameraInputId}
          aria-disabled={isUploading}
          onClick={(event) => {
            if (isUploading) {
              event.preventDefault();
            }
          }}
        >
          <span>
            <Camera aria-hidden="true" />
          </span>
          <strong>Tirar foto</strong>
          <small>Use a camera para capturar o momento</small>
        </label>

        <label
          className={`sheet-option ${isUploading ? "disabled" : ""}`}
          htmlFor={videoInputId}
          aria-disabled={isUploading}
          onClick={(event) => {
            if (isUploading) {
              event.preventDefault();
            }
          }}
        >
          <span>
            <Video aria-hidden="true" />
          </span>
          <strong>Gravar video</strong>
          <small>Capture ate {MAX_VIDEO_DURATION_SECONDS} segundos</small>
        </label>

        <label
          className={`sheet-option ${isUploading ? "disabled" : ""}`}
          htmlFor={galleryInputId}
          aria-disabled={isUploading}
          onClick={(event) => {
            if (isUploading) {
              event.preventDefault();
            }
          }}
        >
          <span>
            <ImageIcon aria-hidden="true" />
          </span>
          <strong>Enviar da galeria</strong>
          <small>
            Ate {MAX_GALLERY_UPLOADS} fotos ou 1 video do seu celular
          </small>
        </label>

        <button className="sheet-cancel" type="button" onClick={onClose}>
          Cancelar
        </button>
      </section>
    </div>
  );
}

export function SuccessScreen({
  photo,
  onSeeGallery,
}: {
  photo: PublicPhoto;
  onSeeGallery: () => void;
}) {
  const imageUrl = photo.imageUrl ?? photo.thumbnailUrl;

  return (
    <div className="screen success-screen">
      <header className="success-header">
        <span />
        <p>Foto adicionada</p>
        <button
          className="icon-button"
          type="button"
          onClick={onSeeGallery}
          aria-label="Fechar"
        >
          <X aria-hidden="true" />
        </button>
      </header>

      {imageUrl ? (
        <img
          className="success-photo"
          src={imageUrl}
          alt={`Foto enviada por ${photo.guestName}`}
        />
      ) : (
        <div className="preview-media-placeholder">
          <ImageIcon aria-hidden="true" />
          <span>Foto indisponivel</span>
        </div>
      )}

      <div className="success-message">
        <span>
          <Check aria-hidden="true" />
        </span>
        <h1>Foto adicionada com sucesso!</h1>
        <p>Obrigado por compartilhar este momento especial!</p>
      </div>

      <button className="primary-button" type="button" onClick={onSeeGallery}>
        Ver galeria
      </button>
    </div>
  );
}

function InlineAlert({ message }: { message: string }) {
  return (
    <p className="inline-alert" role="alert">
      <AlertCircle aria-hidden="true" />
      {message}
    </p>
  );
}
