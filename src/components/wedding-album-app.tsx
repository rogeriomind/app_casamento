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
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearGuestSession,
  getOrCreateDeviceId,
  readGuestSession,
  saveGuestSession,
} from "@/lib/session-storage";
import {
  MAX_PHOTO_TAGS,
  POPULAR_TAGS,
  normalizePhotoTags,
  normalizeTag,
} from "@/lib/photo-tags";
import {
  guestNameSchema,
  normalizeGuestName,
  validateImageFileInput,
} from "@/lib/validators";
import type {
  ApiError,
  PaginatedPhotos,
  PublicEvent,
  PublicGuestSession,
  PublicPhoto,
} from "@/types";

type Step = "welcome" | "name" | "gallery" | "tagging" | "success" | "account";
type NameBackTarget = "welcome" | "account";
type GalleryScope = "all" | "mine";

type PendingUpload = {
  file: File;
  previewUrl: string;
};

const MAX_GALLERY_UPLOADS = 10;

function revokePendingUploads(pendingUploads: PendingUpload[]) {
  pendingUploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
}

function getPhotoSearchTags(photo: PublicPhoto) {
  return photo.tags.map(normalizeTag);
}

type WeddingAlbumAppProps = {
  event: PublicEvent;
  initialPhotos: PublicPhoto[];
};

export function WeddingAlbumApp({ event, initialPhotos }: WeddingAlbumAppProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [nameBackTarget, setNameBackTarget] =
    useState<NameBackTarget>("welcome");
  const [session, setSession] = useState<PublicGuestSession | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PublicPhoto[]>(initialPhotos);
  const [hasLoadedPhotos, setHasLoadedPhotos] = useState(true);
  const [likedStateSessionId, setLikedStateSessionId] = useState<string | null>(
    null,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successPhoto, setSuccessPhoto] = useState<PublicPhoto | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(
    null,
  );
  const cameraInputId = `${event.id}-camera-input`;
  const galleryInputId = `${event.id}-gallery-input`;
  const guestSessionId = session?.guestSessionId ?? null;

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    const storedSession = readGuestSession(event.id);
    if (storedSession) {
      setSession(storedSession);
      setStep("gallery");
    }
    setIsHydrated(true);
  }, [event.id]);

  const sendPresence = useCallback(async () => {
    if (!session || !deviceId) {
      return;
    }

    await fetch(`/api/events/${event.id}/presence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
      },
      body: JSON.stringify({ guestSessionId: session.guestSessionId }),
    });
  }, [deviceId, event.id, session]);

  const loadPhotos = useCallback(async () => {
    setIsGalleryLoading(true);
    setGalleryError(null);

    try {
      const params = new URLSearchParams({ limit: "30" });
      if (guestSessionId) {
        params.set("guestSessionId", guestSessionId);
      }
      const response = await fetch(
        `/api/events/${event.id}/photos?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as PaginatedPhotos;
      setPhotos(data.items);
      setHasLoadedPhotos(true);
      setLikedStateSessionId(guestSessionId);
    } catch (error) {
      setGalleryError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar a galeria.",
      );
    } finally {
      setIsGalleryLoading(false);
    }
  }, [event.id, guestSessionId]);

  useEffect(() => {
    if (
      step === "gallery" &&
      session &&
      (!hasLoadedPhotos || likedStateSessionId !== session.guestSessionId)
    ) {
      void loadPhotos();
    }
  }, [hasLoadedPhotos, likedStateSessionId, loadPhotos, session, step]);

  useEffect(() => {
    if (step !== "gallery" || !session || !deviceId) {
      return;
    }

    function heartbeat() {
      if (document.visibilityState === "visible") {
        void sendPresence().catch(() => undefined);
      }
    }

    heartbeat();
    const interval = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [deviceId, sendPresence, session, step]);

  useEffect(() => {
    if (!highlightedPhotoId) {
      return;
    }

    const timeout = window.setTimeout(() => setHighlightedPhotoId(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [highlightedPhotoId]);

  useEffect(() => {
    return () => {
      revokePendingUploads(pendingUploads);
    };
  }, [pendingUploads]);

  async function handleGuestNameSubmit(guestName: string) {
    if (!deviceId) {
      throw new Error("Nao foi possivel identificar este aparelho.");
    }

    const response = await fetch(`/api/events/${event.id}/guest-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
      },
      body: JSON.stringify({ guestName }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const nextSession = (await response.json()) as PublicGuestSession;
    saveGuestSession(event.id, nextSession);
    setSession(nextSession);
    setLikedStateSessionId(null);
    setStep("gallery");
  }

  function applyPhotoUpdate(nextPhoto: PublicPhoto) {
    setPhotos((current) =>
      current.map((photo) => (photo.id === nextPhoto.id ? nextPhoto : photo)),
    );
    setSelectedPhoto((current) =>
      current?.id === nextPhoto.id ? nextPhoto : current,
    );
    setSuccessPhoto((current) =>
      current?.id === nextPhoto.id ? nextPhoto : current,
    );
  }

  async function togglePhotoLike(photo: PublicPhoto) {
    if (!session) {
      setStep("name");
      return;
    }

    const nextLiked = !photo.isLiked;
    const optimisticPhoto = {
      ...photo,
      isLiked: nextLiked,
      likeCount: Math.max(0, photo.likeCount + (nextLiked ? 1 : -1)),
    };
    applyPhotoUpdate(optimisticPhoto);

    try {
      const response = await fetch(
        `/api/events/${event.id}/photos/${photo.id}/like`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestSessionId: session.guestSessionId,
            liked: nextLiked,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const updatedPhoto = (await response.json()) as PublicPhoto;
      applyPhotoUpdate(updatedPhoto);
    } catch (error) {
      applyPhotoUpdate(photo);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar a curtida.",
      );
    }
  }

  async function deletePhoto(photo: PublicPhoto) {
    if (!session) {
      setNameBackTarget("welcome");
      setStep("name");
      return;
    }

    const confirmed = window.confirm("Excluir esta foto?");
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

      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setSelectedPhoto((current) => (current?.id === photo.id ? null : current));
      setSuccessPhoto((current) => (current?.id === photo.id ? null : current));
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel excluir a foto.",
      );
    } finally {
      setDeletingPhotoIds((current) => {
        const next = new Set(current);
        next.delete(photo.id);
        return next;
      });
    }
  }

  async function uploadPendingPhotos(tags: string[]) {
    if (pendingUploads.length === 0) {
      setStep("gallery");
      return;
    }

    if (!session) {
      setStep("name");
      return;
    }

    setUploadError(null);
    setIsSheetOpen(false);
    setIsUploading(true);

    try {
      const normalizedTags = normalizePhotoTags(tags);
      const publishedPhotos: PublicPhoto[] = [];
      const failedUploads: string[] = [];

      for (const pendingUpload of pendingUploads) {
        const clientValidation = validateImageFileInput(pendingUpload.file);
        if (!clientValidation.ok) {
          failedUploads.push(clientValidation.message);
          continue;
        }

        try {
          const response = await fetch(`/api/events/${event.id}/photos`, {
            method: "POST",
            body: createPhotoFormData(
              pendingUpload.file,
              session.guestSessionId,
              normalizedTags,
            ),
          });

          if (!response.ok) {
            failedUploads.push(await readApiError(response));
            continue;
          }

          publishedPhotos.push((await response.json()) as PublicPhoto);
        } catch {
          failedUploads.push("Nao foi possivel enviar uma das fotos.");
        }
      }

      if (publishedPhotos.length > 0) {
        const publishedIds = new Set(publishedPhotos.map((photo) => photo.id));
        setPhotos((current) => [
          ...publishedPhotos,
          ...current.filter((item) => !publishedIds.has(item.id)),
        ]);
        setSuccessPhoto(publishedPhotos[0] ?? null);
        setHighlightedPhotoId(publishedPhotos[0]?.id ?? null);
      }

      const failureCount = failedUploads.length;
      if (publishedPhotos.length === 0) {
        setUploadError(
          failedUploads[0] ?? "Nao foi possivel publicar as fotos agora.",
        );
        return;
      }

      setHasLoadedPhotos(true);
      setPendingUploads([]);

      if (failureCount > 0) {
        setUploadError(
          `${publishedPhotos.length} fotos publicadas, ${failureCount} falharam.`,
        );
        setStep("gallery");
        return;
      }

      if (publishedPhotos.length === 1) {
        setStep("success");
        return;
      }

      setStep("gallery");
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel publicar as fotos agora.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const isGalleryInput = event.currentTarget.id === galleryInputId;
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const selectedFiles = isGalleryInput ? files : files.slice(0, 1);

    if (isGalleryInput && selectedFiles.length > MAX_GALLERY_UPLOADS) {
      setIsSheetOpen(false);
      setUploadError(`Selecione ate ${MAX_GALLERY_UPLOADS} fotos por vez.`);
      return;
    }

    if (!session) {
      setStep("name");
      return;
    }

    const invalidFile = selectedFiles
      .map((file) => ({ file, validation: validateImageFileInput(file) }))
      .find(({ validation }) => !validation.ok);

    if (invalidFile && !invalidFile.validation.ok) {
      setIsSheetOpen(false);
      setUploadError(
        `${invalidFile.file.name || "Uma foto"}: ${invalidFile.validation.message}`,
      );
      return;
    }

    setUploadError(null);
    setIsSheetOpen(false);
    setPendingUploads(
      selectedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    );
    setStep("tagging");
  }

  function handleCancelTagging() {
    setPendingUploads([]);
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
    clearGuestSession(event.id);
    setSession(null);
    setSelectedPhoto(null);
    setSuccessPhoto(null);
    setIsSheetOpen(false);
    setUploadError(null);
    setGalleryError(null);
    setLikedStateSessionId(null);
    setHasLoadedPhotos(false);
    setPendingUploads([]);
    setPhotos((current) =>
      current.map((photo) => ({
        ...photo,
        isLiked: false,
      })),
    );
    setStep("welcome");
  }

  if (!isHydrated) {
    return (
      <AppShell>
        <div className="center-state">
          <Loader2 aria-hidden="true" className="spin-icon" />
          <p>Carregando album...</p>
        </div>
      </AppShell>
    );
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
        onChange={handleFileChange}
      />
      <input
        id={galleryInputId}
        className="hidden-input"
        type="file"
        accept="image/*"
        multiple
        aria-label="Enviar foto da galeria"
        tabIndex={-1}
        onChange={handleFileChange}
      />

      {step === "welcome" && (
        <WelcomeScreen event={event} onStart={handleStartName} />
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
          isUploading={isUploading}
          deletingPhotoIds={deletingPhotoIds}
          error={galleryError ?? uploadError}
          onAddPhoto={() => setIsSheetOpen(true)}
          onDeletePhoto={(photo) => void deletePhoto(photo)}
          onOpenAccount={() => setStep("account")}
          onSelectPhoto={setSelectedPhoto}
          onToggleLike={(photo) => void togglePhotoLike(photo)}
          onRetry={loadPhotos}
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

      {step === "tagging" && pendingUploads.length > 0 && (
        <TagConfirmationScreen
          pendingUploads={pendingUploads}
          isUploading={isUploading}
          onCancel={handleCancelTagging}
          onPublish={(tags) => void uploadPendingPhotos(tags)}
        />
      )}

      {step === "success" && successPhoto && (
        <SuccessScreen photo={successPhoto} onSeeGallery={handleSeeGallery} />
      )}

      <AddPhotoSheet
        isOpen={isSheetOpen}
        isUploading={isUploading}
        cameraInputId={cameraInputId}
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

function createPhotoFormData(
  file: File,
  guestSessionId: string,
  tags: string[],
) {
  const formData = new FormData();
  formData.append("guestSessionId", guestSessionId);
  formData.append("file", file);
  formData.append("tags", JSON.stringify(tags));
  return formData;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-stage">
      <section className="mobile-shell">{children}</section>
    </main>
  );
}

function WelcomeScreen({
  event,
  onStart,
}: {
  event: PublicEvent;
  onStart: () => void;
}) {
  return (
    <div className="screen welcome-screen">
      <img className="flower-corner left" src="/assets/flor2.png" alt="" />
      <img className="flower-corner right" src="/assets/flor2.png" alt="" />

      <div className="welcome-copy">
        <p className="couple-name">{event.coupleName}</p>
        <h1>Bem-vindo ao album do casamento</h1>
        <p>Estamos muito felizes que voce esteja aqui!</p>
        <p>Compartilhe os melhores momentos deste dia especial conosco.</p>
      </div>

      <div className="couple-illustration-wrap">
        <img
          className="couple-illustration"
          src="/assets/nos.png"
          alt="Ilustracao dos noivos"
        />
        <img className="flower-base" src="/assets/flor.png" alt="" />
      </div>

      <button className="primary-button" type="button" onClick={onStart}>
        Comecar
      </button>
    </div>
  );
}

function NameScreen({
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

function TagConfirmationScreen({
  pendingUploads,
  isUploading,
  onCancel,
  onPublish,
}: {
  pendingUploads: PendingUpload[];
  isUploading: boolean;
  onCancel: () => void;
  onPublish: (tags: string[]) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const uploadCount = pendingUploads.length;
  const isMultiple = uploadCount > 1;

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
          {isMultiple
            ? "Adicione tags que descrevem estas fotos."
            : "Adicione tags que descrevem esta foto."}
        </p>
      </header>

      <div className={`tag-preview-card ${isMultiple ? "multiple" : ""}`}>
        <div className="tag-preview-grid">
          {pendingUploads.map((upload, index) => (
            <img
              src={upload.previewUrl}
              alt={`Pre-visualizacao da foto ${index + 1}`}
              key={`${upload.previewUrl}-${index}`}
            />
          ))}
        </div>
        <span className="tag-photo-count">
          {uploadCount} {uploadCount === 1 ? "foto selecionada" : "fotos selecionadas"}
        </span>
        <p>
          <Tag aria-hidden="true" />
          {isMultiple
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
          Use tags para tornar sua foto mais facil de encontrar.
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

function GalleryScreen({
  event,
  photos,
  guestName,
  highlightedPhotoId,
  isGalleryLoading,
  isUploading,
  deletingPhotoIds,
  error,
  onAddPhoto,
  onDeletePhoto,
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
  isUploading: boolean;
  deletingPhotoIds: Set<string>;
  error: string | null;
  onAddPhoto: () => void;
  onDeletePhoto: (photo: PublicPhoto) => void;
  onOpenAccount: () => void;
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
  onRetry: () => void;
}) {
  const [galleryScope, setGalleryScope] = useState<GalleryScope>("mine");
  const [tagSearch, setTagSearch] = useState("");
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
  const normalizedTagSearch = normalizeTag(tagSearch);
  const filteredAllPhotos = useMemo(() => {
    if (!normalizedTagSearch) {
      return photos;
    }

    return photos.filter((photo) =>
      getPhotoSearchTags(photo).some((tag) => tag.includes(normalizedTagSearch)),
    );
  }, [normalizedTagSearch, photos]);
  const visiblePhotos =
    galleryScope === "mine" ? myPhotos : filteredAllPhotos;
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
              className={!normalizedTagSearch ? "active" : ""}
              type="button"
              onClick={() => setTagSearch("")}
            >
              Todas
            </button>
            {POPULAR_TAGS.map((tag) => {
              const isActive = normalizedTagSearch === tag;

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
        <div className="photo-grid" aria-label="Fotos do casamento">
          {visiblePhotos.map((photo) => (
            <PhotoGridButton
              key={photo.id}
              photo={photo}
              galleryScope={galleryScope}
              isHighlighted={highlightedPhotoId === photo.id}
              isDeleting={deletingPhotoIds.has(photo.id)}
              onDeletePhoto={onDeletePhoto}
              onSelectPhoto={onSelectPhoto}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
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
          Enviando foto...
        </div>
      )}

      <button className="floating-add-button" type="button" onClick={onAddPhoto}>
        <span aria-hidden="true">+</span>
        Adicionar foto
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

function AccountScreen({
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

function PhotoGridButton({
  photo,
  galleryScope,
  isHighlighted,
  isDeleting,
  onDeletePhoto,
  onSelectPhoto,
  onToggleLike,
}: {
  photo: PublicPhoto;
  galleryScope: GalleryScope;
  isHighlighted: boolean;
  isDeleting: boolean;
  onDeletePhoto: (photo: PublicPhoto) => void;
  onSelectPhoto: (photo: PublicPhoto) => void;
  onToggleLike: (photo: PublicPhoto) => void;
}) {
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const lastTapAtRef = useRef(0);

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function handlePointerDown() {
    if (galleryScope !== "all") {
      return;
    }

    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onSelectPhoto(photo);
    }, 2000);
  }

  function handlePointerUp() {
    if (galleryScope !== "all") {
      return;
    }

    clearLongPress();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const now = Date.now();
    if (now - lastTapAtRef.current < 360) {
      lastTapAtRef.current = 0;
      onToggleLike(photo);
      return;
    }

    lastTapAtRef.current = now;
  }

  const canDelete = galleryScope === "mine" && photo.canDelete;

  return (
    <div
      className={`photo-card ${isHighlighted ? "highlighted" : ""} ${
        photo.isLiked ? "liked" : ""
      } ${isDeleting ? "deleting" : ""}`}
    >
      <button
        className="photo-card-main"
        type="button"
        disabled={isDeleting}
        onClick={() => {
          if (galleryScope !== "all") {
            onSelectPhoto(photo);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(event) => {
          if (galleryScope === "all") {
            event.preventDefault();
          }
        }}
        aria-label={
          galleryScope === "all"
            ? `Toque duas vezes para curtir. Segure por 2 segundos para abrir foto enviada por ${photo.guestName}`
            : `Abrir foto enviada por ${photo.guestName}`
        }
      >
        <img
          src={photo.thumbnailUrl ?? photo.imageUrl}
          alt={`Foto enviada por ${photo.guestName}`}
          loading="lazy"
          decoding="async"
        />
        {galleryScope === "all" && (
          <span className="photo-like-badge">
            <Heart aria-hidden="true" />
            {photo.likeCount}
          </span>
        )}
      </button>

      {canDelete && (
        <button
          className="photo-delete-button"
          type="button"
          disabled={isDeleting}
          onClick={() => onDeletePhoto(photo)}
          aria-label={`Excluir foto enviada por ${photo.guestName}`}
          title="Excluir foto"
        >
          {isDeleting ? (
            <Loader2 aria-hidden="true" className="spin-icon small" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

function PhotoPreviewModal({
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

  const downloadName = `foto-casamento-${photo.id}.jpg`;

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
        aria-label="Pre-visualizar foto"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="preview-header">
          <div>
            <p>Foto enviada por</p>
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

        <img
          className="preview-photo"
          src={photo.imageUrl}
          alt={`Foto enviada por ${photo.guestName}`}
        />

        <button
          className={`preview-like-button ${photo.isLiked ? "liked" : ""}`}
          type="button"
          onClick={() => onToggleLike(photo)}
          aria-label={photo.isLiked ? "Remover curtida" : "Curtir foto"}
        >
          <span>
            <Heart aria-hidden="true" />
          </span>
          <strong>{photo.isLiked ? "Curtido" : "Curtir"}</strong>
          <small>{photo.likeCount}</small>
        </button>

        <a
          className="download-button"
          href={photo.imageUrl}
          download={downloadName}
          target="_blank"
          rel="noreferrer"
        >
          <Download aria-hidden="true" />
          Baixar foto
        </a>
      </section>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="photo-grid skeleton-grid" aria-label="Carregando galeria">
      {Array.from({ length: 9 }, (_, index) => (
        <div className="photo-card skeleton-card" key={index} />
      ))}
    </div>
  );
}

function AddPhotoSheet({
  isOpen,
  isUploading,
  cameraInputId,
  galleryInputId,
  onClose,
}: {
  isOpen: boolean;
  isUploading: boolean;
  cameraInputId: string;
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
          <small>Selecione ate {MAX_GALLERY_UPLOADS} fotos do seu celular</small>
        </label>

        <button className="sheet-cancel" type="button" onClick={onClose}>
          Cancelar
        </button>
      </section>
    </div>
  );
}

function SuccessScreen({
  photo,
  onSeeGallery,
}: {
  photo: PublicPhoto;
  onSeeGallery: () => void;
}) {
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

      <img
        className="success-photo"
        src={photo.imageUrl}
        alt={`Foto enviada por ${photo.guestName}`}
      />

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
