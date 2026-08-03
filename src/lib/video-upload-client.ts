"use client";

import * as tus from "tus-js-client";
import type { ApiError } from "@/types";

export type InitBunnyVideoUploadResponse = {
  photoId: string;
  status: "uploading";
  streamVideoId: string;
  tus: {
    endpoint: string;
    headers: {
      AuthorizationSignature: string;
      AuthorizationExpire: string;
      LibraryId: string;
      VideoId: string;
    };
    metadata: {
      filetype: string;
      title: string;
    };
  };
};

export type BunnyTusUploadController = {
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  cleanup: () => void;
};

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  return data?.error ?? "Nao foi possivel iniciar o envio do video.";
}

export async function readVideoDurationSeconds(file: File) {
  if (typeof document === "undefined") {
    return null;
  }

  return new Promise<number | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    function cleanup(value: number | null) {
      if (settled) {
        return;
      }

      settled = true;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    }

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      cleanup(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => cleanup(null);
    video.src = objectUrl;
  });
}

export async function initBunnyVideoUpload({
  eventId,
  guestSessionId,
  file,
  tags,
  durationSeconds,
}: {
  eventId: string;
  guestSessionId: string;
  file: File;
  tags: string[];
  durationSeconds: number | null;
}) {
  const response = await fetch(`/api/events/${eventId}/videos/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestSessionId,
      fileName: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
      durationSeconds,
      tags,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as InitBunnyVideoUploadResponse;
}

export function createBunnyTusUploadController({
  file,
  init,
  onProgress,
  onSuccess,
  onError,
}: {
  file: File;
  init: InitBunnyVideoUploadResponse;
  onProgress: (progress: number) => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
}): BunnyTusUploadController {
  let isSettled = false;
  const upload = new tus.Upload(file, {
    endpoint: init.tus.endpoint,
    headers: init.tus.headers,
    metadata: init.tus.metadata,
    retryDelays: [0, 1000, 3000, 5000],
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
    onProgress(bytesSent, bytesTotal) {
      if (bytesTotal <= 0) {
        return;
      }

      onProgress(Math.min(94, Math.round((bytesSent / bytesTotal) * 94)));
    },
    onShouldRetry(error) {
      const status = error.originalResponse?.getStatus() ?? 0;
      return status !== 401 && status !== 403;
    },
    onSuccess() {
      isSettled = true;
      onSuccess();
    },
    onError(error) {
      isSettled = true;
      onError(error);
    },
  });

  return {
    async start() {
      const previousUploads = await upload.findPreviousUploads();
      const previousUpload = previousUploads[0];
      if (previousUpload) {
        upload.resumeFromPreviousUpload(previousUpload);
      }

      upload.start();
    },
    async cancel() {
      isSettled = true;
      await upload.abort(true);
    },
    cleanup() {
      if (!isSettled) {
        void upload.abort(false).catch(() => undefined);
      }
    },
  };
}
