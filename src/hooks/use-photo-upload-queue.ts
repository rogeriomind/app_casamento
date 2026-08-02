"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { normalizePhotoTags } from "@/lib/photo-tags";
import { validateImageFileInput } from "@/lib/validators";
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
  previewUrl: string;
  status: UploadItemStatus;
  progress: number;
  error?: string;
  publishedPhotoId?: string;
};

type UploadState = {
  items: UploadItem[];
  isUploading: boolean;
};

type UploadAction =
  | { type: "set-files"; files: File[] }
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
        items: action.files.map((file) => ({
          id: createUploadId(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: "waiting",
          progress: 0,
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

function getUploadConcurrency() {
  const isLikelyMobile =
    navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
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

  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  useEffect(() => {
    const xhrs = xhrsRef.current;
    return () => {
      xhrs.forEach((xhr) => xhr.abort());
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const setFiles = useCallback((files: File[]) => {
    dispatch({ type: "set-files", files });
  }, []);

  const clear = useCallback(() => {
    xhrsRef.current.forEach((xhr) => xhr.abort());
    xhrsRef.current.clear();
    dispatch({ type: "clear" });
  }, []);

  const cancelItem = useCallback((itemId: string) => {
    const xhr = xhrsRef.current.get(itemId);
    if (xhr) {
      xhr.abort();
      xhrsRef.current.delete(itemId);
    }
    dispatch({
      type: "item-update",
      id: itemId,
      patch: { status: "cancelled", progress: 0, error: undefined },
    });
  }, []);

  const uploadItem = useCallback(
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
            const photo = JSON.parse(xhr.responseText) as PublicPhoto;
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
            summary.firstPhoto ??= photo;
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
        Array.from({ length: Math.min(getUploadConcurrency(), queue.length) }, () =>
          worker(),
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
