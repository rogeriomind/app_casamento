"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { normalizePhotoTags } from "@/lib/photo-tags";
import {
  validateImageFileInput,
  validateVideoFileInput,
} from "@/lib/validators";
import {
  createBunnyTusUploadController,
  initBunnyVideoUpload,
  type BunnyTusUploadController,
} from "@/lib/video-upload-client";
import type { PublicPhoto } from "@/types";

export type UploadItemStatus =
  | "waiting"
  | "preparing"
  | "uploading"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

export type UploadItem = {
  id: string;
  file: File;
  mediaType: "image" | "video";
  previewUrl: string;
  status: UploadItemStatus;
  progress: number;
  durationSeconds?: number | null;
  error?: string;
  publishedPhotoId?: string;
};

export type UploadFileSelection = {
  file: File;
  mediaType: UploadItem["mediaType"];
  durationSeconds?: number | null;
};

type UploadState = {
  items: UploadItem[];
  isUploading: boolean;
};

type UploadAction =
  | { type: "set-files"; selections: UploadFileSelection[] }
  | { type: "clear" }
  | { type: "upload-start" }
  | { type: "upload-end" }
  | {
      type: "item-update";
      id: string;
      patch: Partial<
        Pick<UploadItem, "status" | "progress" | "error" | "publishedPhotoId">
      >;
    };

export type UploadSummary = {
  successCount: number;
  errorCount: number;
  cancelledCount: number;
  firstPhoto: PublicPhoto | null;
};

function createUploadId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function reducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "set-files":
      state.items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return {
        isUploading: false,
        items: action.selections.map((selection) => ({
          id: createUploadId(),
          file: selection.file,
          mediaType: selection.mediaType,
          previewUrl: URL.createObjectURL(selection.file),
          status: "waiting",
          progress: 0,
          durationSeconds: selection.durationSeconds,
        })),
      };
    case "clear":
      state.items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return { items: [], isUploading: false };
    case "upload-start":
      return { ...state, isUploading: true };
    case "upload-end":
      return { ...state, isUploading: false };
    case "item-update":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      };
  }
}

function getUploadConcurrency(queue: UploadItem[]) {
  if (queue.some((item) => item.mediaType === "video")) {
    return 1;
  }

  const isLikelyMobile =
    navigator.maxTouchPoints > 0 ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return isLikelyMobile ? 2 : 3;
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

function parseXhrError(xhr: XMLHttpRequest) {
  try {
    const data = JSON.parse(xhr.responseText) as { error?: string };
    return data.error ?? "Nao foi possivel enviar uma das fotos.";
  } catch {
    return "Nao foi possivel enviar uma das fotos.";
  }
}

export function usePhotoUploadQueue({
  eventId,
  onPhotoPublished,
}: {
  eventId: string;
  onPhotoPublished: (photo: PublicPhoto) => void;
}) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    isUploading: false,
  });
  const itemsRef = useRef(state.items);
  const xhrsRef = useRef(new Map<string, XMLHttpRequest>());
  const tusUploadsRef = useRef(new Map<string, BunnyTusUploadController>());

  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  useEffect(() => {
    const xhrs = xhrsRef.current;
    const tusUploads = tusUploadsRef.current;
    return () => {
      xhrs.forEach((xhr) => xhr.abort());
      tusUploads.forEach((upload) => upload.cleanup());
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const setFiles = useCallback((selections: UploadFileSelection[]) => {
    dispatch({ type: "set-files", selections });
  }, []);

  const clear = useCallback(() => {
    xhrsRef.current.forEach((xhr) => xhr.abort());
    xhrsRef.current.clear();
    tusUploadsRef.current.forEach((upload) => upload.cleanup());
    tusUploadsRef.current.clear();
    dispatch({ type: "clear" });
  }, []);

  const cancelItem = useCallback((itemId: string) => {
    const xhr = xhrsRef.current.get(itemId);
    if (xhr) {
      xhr.abort();
      xhrsRef.current.delete(itemId);
    }
    const tusUpload = tusUploadsRef.current.get(itemId);
    if (tusUpload) {
      void tusUpload.cancel().catch(() => undefined);
      tusUploadsRef.current.delete(itemId);
    }
    dispatch({
      type: "item-update",
      id: itemId,
      patch: { status: "cancelled", progress: 0, error: undefined },
    });
  }, []);

  const uploadImageItem = useCallback(
    (item: UploadItem, guestSessionId: string, tags: string[]) =>
      new Promise<PublicPhoto>((resolve, reject) => {
        const validation = validateImageFileInput(item.file);
        if (!validation.ok) {
          dispatch({
            type: "item-update",
            id: item.id,
            patch: {
              status: "error",
              progress: 0,
              error: validation.message,
            },
          });
          reject(new Error(validation.message));
          return;
        }

        const xhr = new XMLHttpRequest();
        xhrsRef.current.set(item.id, xhr);
        dispatch({
          type: "item-update",
          id: item.id,
          patch: { status: "uploading", progress: 1, error: undefined },
        });

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            return;
          }
          const progress = Math.min(94, Math.round((event.loaded / event.total) * 94));
          dispatch({
            type: "item-update",
            id: item.id,
            patch: { status: "uploading", progress },
          });
        };

        xhr.upload.onload = () => {
          dispatch({
            type: "item-update",
            id: item.id,
            patch: { status: "processing", progress: 95 },
          });
        };

        xhr.onload = () => {
          xhrsRef.current.delete(item.id);
          if (xhr.status >= 200 && xhr.status < 300) {
            let photo: PublicPhoto;
            try {
              photo = JSON.parse(xhr.responseText) as PublicPhoto;
            } catch {
              const error = "Nao foi possivel ler a resposta do envio.";
              dispatch({
                type: "item-update",
                id: item.id,
                patch: { status: "error", progress: 0, error },
              });
              reject(new Error(error));
              return;
            }
            dispatch({
              type: "item-update",
              id: item.id,
              patch: {
                status: "success",
                progress: 100,
                publishedPhotoId: photo.id,
                error: undefined,
              },
            });
            onPhotoPublished(photo);
            resolve(photo);
            return;
          }

          const error = parseXhrError(xhr);
          dispatch({
            type: "item-update",
            id: item.id,
            patch: { status: "error", progress: 0, error },
          });
          reject(new Error(error));
        };

        xhr.onerror = () => {
          xhrsRef.current.delete(item.id);
          dispatch({
            type: "item-update",
            id: item.id,
            patch: {
              status: "error",
              progress: 0,
              error: "Falha de rede durante o upload.",
            },
          });
          reject(new Error("Falha de rede durante o upload."));
        };

        xhr.onabort = () => {
          xhrsRef.current.delete(item.id);
          dispatch({
            type: "item-update",
            id: item.id,
            patch: { status: "cancelled", progress: 0, error: undefined },
          });
          reject(new Error("Upload cancelado."));
        };

        dispatch({
          type: "item-update",
          id: item.id,
          patch: { status: "preparing", progress: 0, error: undefined },
        });
        xhr.open("POST", `/api/events/${eventId}/photos`);
        xhr.send(createPhotoFormData(item.file, guestSessionId, tags));
      }),
    [eventId, onPhotoPublished],
  );

  const uploadVideoItem = useCallback(
    async (item: UploadItem, guestSessionId: string, tags: string[]) => {
      const validation = validateVideoFileInput({
        name: item.file.name,
        type: item.file.type,
        size: item.file.size,
        durationSeconds: item.durationSeconds,
      });
      if (!validation.ok) {
        dispatch({
          type: "item-update",
          id: item.id,
          patch: {
            status: "error",
            progress: 0,
            error: validation.message,
          },
        });
        throw new Error(validation.message);
      }

      dispatch({
        type: "item-update",
        id: item.id,
        patch: { status: "preparing", progress: 0, error: undefined },
      });

      let init: Awaited<ReturnType<typeof initBunnyVideoUpload>>;
      try {
        init = await initBunnyVideoUpload({
          eventId,
          guestSessionId,
          file: item.file,
          tags,
          durationSeconds: item.durationSeconds ?? null,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nao foi possivel iniciar o envio do video.";
        dispatch({
          type: "item-update",
          id: item.id,
          patch: { status: "error", progress: 0, error: message },
        });
        throw new Error(message);
      }

      const latestAfterInit = itemsRef.current.find(
        (entry) => entry.id === item.id,
      );
      if (latestAfterInit?.status === "cancelled") {
        throw new Error("Upload cancelado.");
      }

      return new Promise<PublicPhoto | null>((resolve, reject) => {
        const controller = createBunnyTusUploadController({
          file: item.file,
          init,
          onProgress(progress) {
            dispatch({
              type: "item-update",
              id: item.id,
              patch: { status: "uploading", progress, error: undefined },
            });
          },
          onSuccess() {
            tusUploadsRef.current.delete(item.id);
            dispatch({
              type: "item-update",
              id: item.id,
              patch: { status: "processing", progress: 100, error: undefined },
            });
            resolve(null);
          },
          onError(error) {
            tusUploadsRef.current.delete(item.id);
            const message = error.message || "Falha de rede durante o upload.";
            dispatch({
              type: "item-update",
              id: item.id,
              patch: { status: "error", progress: 0, error: message },
            });
            reject(new Error(message));
          },
        });

        tusUploadsRef.current.set(item.id, controller);
        dispatch({
          type: "item-update",
          id: item.id,
          patch: { status: "uploading", progress: 1, error: undefined },
        });

        controller.start().catch((error: unknown) => {
          tusUploadsRef.current.delete(item.id);
          const message =
            error instanceof Error
              ? error.message
              : "Falha de rede durante o upload.";
          dispatch({
            type: "item-update",
            id: item.id,
            patch: { status: "error", progress: 0, error: message },
          });
          reject(new Error(message));
        });
      });
    },
    [eventId],
  );

  const uploadItem = useCallback(
    (item: UploadItem, guestSessionId: string, tags: string[]) => {
      if (item.mediaType === "video") {
        return uploadVideoItem(item, guestSessionId, tags);
      }

      return uploadImageItem(item, guestSessionId, tags);
    },
    [uploadImageItem, uploadVideoItem],
  );

  const start = useCallback(
    async (guestSessionId: string, tags: string[], onlyItemId?: string) => {
      const normalizedTags = normalizePhotoTags(tags);
      const queue = itemsRef.current.filter((item) => {
        if (onlyItemId && item.id !== onlyItemId) {
          return false;
        }
        return item.status === "waiting" || item.status === "error";
      });
      const summary: UploadSummary = {
        successCount: 0,
        errorCount: 0,
        cancelledCount: 0,
        firstPhoto: null,
      };

      if (queue.length === 0) {
        return summary;
      }

      dispatch({ type: "upload-start" });

      let nextIndex = 0;
      async function worker() {
        while (nextIndex < queue.length) {
          const item = queue[nextIndex];
          nextIndex += 1;

          const currentItem = itemsRef.current.find((entry) => entry.id === item.id);
          if (currentItem?.status === "cancelled") {
            summary.cancelledCount += 1;
            continue;
          }

          try {
            const photo = await uploadItem(item, guestSessionId, normalizedTags);
            summary.successCount += 1;
            if (photo) {
              summary.firstPhoto ??= photo;
            }
          } catch {
            const latest = itemsRef.current.find((entry) => entry.id === item.id);
            if (latest?.status === "cancelled") {
              summary.cancelledCount += 1;
            } else {
              summary.errorCount += 1;
            }
          }
        }
      }

      await Promise.allSettled(
        Array.from(
          { length: Math.min(getUploadConcurrency(queue), queue.length) },
          () => worker(),
        ),
      );

      dispatch({ type: "upload-end" });
      return summary;
    },
    [uploadItem],
  );

  return {
    items: state.items,
    isUploading: state.isUploading,
    setFiles,
    clear,
    cancelItem,
    start,
  };
}
