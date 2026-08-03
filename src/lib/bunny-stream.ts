import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { validateBunnyStreamEnv } from "@/lib/env";

const BUNNY_STREAM_API_BASE_URL = "https://video.bunnycdn.com";
const BUNNY_STREAM_TUS_ENDPOINT = `${BUNNY_STREAM_API_BASE_URL}/tusupload`;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_TUS_EXPIRATION_SECONDS = 60 * 60;
const DEFAULT_THUMBNAIL_FILE_NAME = "thumbnail.jpg";

export const BUNNY_STREAM_STATUS = {
  queued: 0,
  processing: 1,
  encoding: 2,
  finished: 3,
  resolutionFinished: 4,
  failed: 5,
  presignedUploadStarted: 6,
  presignedUploadFinished: 7,
  presignedUploadFailed: 8,
} as const;

export type BunnyStreamConfig = {
  libraryId: string;
  apiKey: string;
  pullZoneHostname: string;
  webhookSecret: string;
  apiBaseUrl?: string;
  tusEndpoint?: string;
  requestTimeoutMs?: number;
};

export type BunnyStreamVideo = {
  videoLibraryId: string;
  guid: string;
  title: string;
  length: number | null;
  status: number | null;
  width: number | null;
  height: number | null;
  thumbnailFileName: string | null;
  thumbnailUrl: string | null;
};

export type BunnyTusSignature = {
  endpoint: string;
  libraryId: string;
  videoId: string;
  authorizationExpire: number;
  authorizationSignature: string;
};

export type BunnyStreamWebhookHeaders = {
  signature: string | null;
  version: string | null;
  algorithm: string | null;
};

export class BunnyStreamError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BunnyStreamError";
  }
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function getRequestTimeoutMs(config: BunnyStreamConfig) {
  const configured = config.requestTimeoutMs;
  if (!Number.isInteger(configured) || !configured || configured < 1) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return configured;
}

function getApiBaseUrl(config: BunnyStreamConfig) {
  return trimTrailingSlashes(config.apiBaseUrl ?? BUNNY_STREAM_API_BASE_URL);
}

function getTusEndpoint(config: BunnyStreamConfig) {
  return config.tusEndpoint ?? BUNNY_STREAM_TUS_ENDPOINT;
}

function getEnvRequestTimeoutMs() {
  const configured = Number(process.env.BUNNY_STREAM_REQUEST_TIMEOUT_MS);
  if (!Number.isInteger(configured) || configured < 1) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return configured;
}

export function getBunnyStreamConfig(): BunnyStreamConfig {
  try {
    return {
      ...validateBunnyStreamEnv(),
      requestTimeoutMs: getEnvRequestTimeoutMs(),
    };
  } catch {
    throw new BunnyStreamError(
      "Bunny Stream nao esta configurado.",
      "BUNNY_STREAM_NOT_CONFIGURED",
    );
  }
}

function asRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseBunnyVideo(value: unknown): BunnyStreamVideo {
  const record = asRecord(value);
  const guid = record ? readString(record, "guid") : null;

  if (!record || !guid) {
    throw new BunnyStreamError(
      "Bunny Stream retornou uma resposta inesperada.",
      "BUNNY_STREAM_INVALID_RESPONSE",
    );
  }

  const responseLibraryId = record.videoLibraryId;

  return {
    videoLibraryId:
      typeof responseLibraryId === "number" || typeof responseLibraryId === "string"
        ? String(responseLibraryId)
        : "",
    guid,
    title: readString(record, "title") ?? "",
    length: readNumber(record, "length"),
    status: readNumber(record, "status"),
    width: readNumber(record, "width"),
    height: readNumber(record, "height"),
    thumbnailFileName: readString(record, "thumbnailFileName"),
    thumbnailUrl: readString(record, "thumbnailUrl"),
  };
}

async function parseJsonResponse(response: Response) {
  const body = await response.text();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new BunnyStreamError(
      "Bunny Stream retornou uma resposta nao JSON.",
      "BUNNY_STREAM_INVALID_JSON",
      response.status,
    );
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  config: BunnyStreamConfig,
  fetchFn: typeof fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getRequestTimeoutMs(config),
  );

  try {
    return await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BunnyStreamError(
        "Tempo esgotado ao falar com Bunny Stream.",
        "BUNNY_STREAM_TIMEOUT",
      );
    }

    throw new BunnyStreamError(
      "Falha de rede ao falar com Bunny Stream.",
      "BUNNY_STREAM_NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function requestBunnyStreamJson(
  path: string,
  init: RequestInit,
  config: BunnyStreamConfig,
  fetchFn: typeof fetch,
) {
  const response = await fetchWithTimeout(
    `${getApiBaseUrl(config)}${path}`,
    {
      ...init,
      headers: {
        AccessKey: config.apiKey,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    },
    config,
    fetchFn,
  );

  if (!response.ok) {
    throw new BunnyStreamError(
      `Bunny Stream rejeitou a requisicao com status ${response.status}.`,
      "BUNNY_STREAM_REQUEST_FAILED",
      response.status,
    );
  }

  return parseJsonResponse(response);
}

export function getBunnyStreamEmbedUrl(
  videoId: string,
  config: BunnyStreamConfig = getBunnyStreamConfig(),
  params: Record<string, string | boolean | number> = {},
) {
  const url = new URL(
    `https://player.mediadelivery.net/embed/${config.libraryId}/${videoId}`,
  );
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export function getBunnyStreamPlaybackUrl(
  videoId: string,
  config: BunnyStreamConfig = getBunnyStreamConfig(),
  params: Record<string, string | boolean | number> = {},
) {
  const url = new URL(
    `https://player.mediadelivery.net/play/${config.libraryId}/${videoId}`,
  );
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export function getBunnyStreamThumbnailUrl(
  videoId: string,
  config: BunnyStreamConfig = getBunnyStreamConfig(),
  fileName = DEFAULT_THUMBNAIL_FILE_NAME,
) {
  const safeFileName = fileName.split("/").filter(Boolean).join("/");
  return `https://${config.pullZoneHostname}/${encodeURIComponent(
    videoId,
  )}/${safeFileName || DEFAULT_THUMBNAIL_FILE_NAME}`;
}

export function createBunnyTusSignature(
  videoId: string,
  options: {
    expiresAt?: number;
    now?: Date;
    config?: BunnyStreamConfig;
  } = {},
): BunnyTusSignature {
  const config = options.config ?? getBunnyStreamConfig();
  const authorizationExpire =
    options.expiresAt ??
    Math.floor(
      ((options.now ?? new Date()).getTime() +
        DEFAULT_TUS_EXPIRATION_SECONDS * 1000) /
        1000,
    );
  const authorizationSignature = createHash("sha256")
    .update(`${config.libraryId}${config.apiKey}${authorizationExpire}${videoId}`)
    .digest("hex");

  return {
    endpoint: getTusEndpoint(config),
    libraryId: config.libraryId,
    videoId,
    authorizationExpire,
    authorizationSignature,
  };
}

export async function createBunnyStreamVideo(
  input: {
    title: string;
    collectionId?: string | null;
  },
  options: {
    config?: BunnyStreamConfig;
    fetchFn?: typeof fetch;
  } = {},
) {
  const config = options.config ?? getBunnyStreamConfig();
  const fetchFn = options.fetchFn ?? fetch;
  const body = {
    title: input.title,
    ...(input.collectionId ? { collectionId: input.collectionId } : {}),
  };

  const json = await requestBunnyStreamJson(
    `/library/${config.libraryId}/videos`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    config,
    fetchFn,
  );

  return parseBunnyVideo(json);
}

export async function getBunnyStreamVideo(
  videoId: string,
  options: {
    config?: BunnyStreamConfig;
    fetchFn?: typeof fetch;
  } = {},
) {
  const config = options.config ?? getBunnyStreamConfig();
  const fetchFn = options.fetchFn ?? fetch;
  const json = await requestBunnyStreamJson(
    `/library/${config.libraryId}/videos/${videoId}`,
    { method: "GET" },
    config,
    fetchFn,
  );

  return parseBunnyVideo(json);
}

export async function deleteBunnyStreamVideo(
  videoId: string,
  options: {
    config?: BunnyStreamConfig;
    fetchFn?: typeof fetch;
  } = {},
) {
  const config = options.config ?? getBunnyStreamConfig();
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchWithTimeout(
    `${getApiBaseUrl(config)}/library/${config.libraryId}/videos/${videoId}`,
    {
      method: "DELETE",
      headers: {
        AccessKey: config.apiKey,
      },
    },
    config,
    fetchFn,
  );

  if (!response.ok && response.status !== 404) {
    throw new BunnyStreamError(
      `Bunny Stream rejeitou a remocao com status ${response.status}.`,
      "BUNNY_STREAM_DELETE_FAILED",
      response.status,
    );
  }
}

export function verifyBunnyStreamWebhookSignature(
  rawBody: Buffer,
  headers: BunnyStreamWebhookHeaders,
  config: BunnyStreamConfig = getBunnyStreamConfig(),
) {
  if (headers.version !== "v1" || headers.algorithm !== "hmac-sha256") {
    return false;
  }

  const signature = headers.signature?.toLowerCase() ?? "";
  if (signature.length !== 64 || !/^[0-9a-f]+$/.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", config.webhookSecret)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
}
