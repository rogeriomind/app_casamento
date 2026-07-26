import { createHash } from "node:crypto";
import { validateBunnyStorageEnv } from "@/lib/env";

export type BunnyStorageConfig = {
  storageEndpoint: string;
  storagePassword: string;
  publicBaseUrl: string;
};

export type BunnyUploadOptions = {
  contentType?: string;
  cacheControl?: string;
  config?: BunnyStorageConfig;
  fetchFn?: typeof fetch;
};

export class BunnyStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BunnyStorageError";
  }
}

export function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function normalizeBunnyObjectPath(objectPath: string) {
  const segments = objectPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    throw new BunnyStorageError(
      "Caminho de arquivo invalido para o storage.",
      "INVALID_STORAGE_PATH",
    );
  }

  return segments.map(encodeURIComponent).join("/");
}

function buildUrl(baseUrl: string, objectPath: string) {
  return `${trimTrailingSlashes(baseUrl)}/${normalizeBunnyObjectPath(objectPath)}`;
}

export function getBunnyStorageConfig(): BunnyStorageConfig {
  try {
    return validateBunnyStorageEnv();
  } catch {
    throw new BunnyStorageError(
      "Bunny Storage nao esta configurado.",
      "BUNNY_STORAGE_NOT_CONFIGURED",
    );
  }
}

export function getBunnyPublicBaseUrl() {
  try {
    return validateBunnyStorageEnv().publicBaseUrl;
  } catch {
    throw new BunnyStorageError(
      "URL publica do Bunny nao esta configurada.",
      "BUNNY_PUBLIC_BASE_URL_NOT_CONFIGURED",
    );
  }
}

export function getBunnyPublicUrl(
  objectPath: string,
  config = getBunnyStorageConfig(),
) {
  return buildUrl(config.publicBaseUrl, objectPath);
}

export function getBunnyObjectPathFromPublicUrl(
  urlString: string,
  publicBaseUrl = getBunnyPublicBaseUrl(),
) {
  try {
    const baseUrl = new URL(`${trimTrailingSlashes(publicBaseUrl)}/`);
    const targetUrl = new URL(urlString);

    if (
      targetUrl.origin !== baseUrl.origin ||
      !targetUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      return null;
    }

    const objectPath = targetUrl.pathname.slice(baseUrl.pathname.length);
    if (!objectPath) {
      return null;
    }

    return objectPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

export function isBunnyPublicUrl(urlString: string) {
  return getBunnyObjectPathFromPublicUrl(urlString) !== null;
}

export async function uploadBunnyObject(
  objectPath: string,
  buffer: Buffer,
  options: BunnyUploadOptions = {},
) {
  const config = options.config ?? getBunnyStorageConfig();
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildUrl(config.storageEndpoint, objectPath), {
    method: "PUT",
    headers: {
      AccessKey: config.storagePassword,
      "Content-Type": options.contentType ?? "application/octet-stream",
      Checksum: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
      ...(options.cacheControl ? { "Cache-Control": options.cacheControl } : {}),
    },
    body: new Uint8Array(buffer),
  });

  if (response.status !== 201) {
    throw new BunnyStorageError(
      `Bunny Storage rejeitou o upload com status ${response.status}.`,
      "BUNNY_UPLOAD_FAILED",
      response.status,
    );
  }

  return getBunnyPublicUrl(objectPath, config);
}

export async function headBunnyObject(
  objectPath: string,
  config = getBunnyStorageConfig(),
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(buildUrl(config.storageEndpoint, objectPath), {
    method: "HEAD",
    headers: {
      AccessKey: config.storagePassword,
    },
  });

  if (!response.ok) {
    throw new BunnyStorageError(
      `Bunny Storage rejeitou a consulta com status ${response.status}.`,
      "BUNNY_HEAD_FAILED",
      response.status,
    );
  }

  return response;
}

export async function downloadBunnyObject(
  objectPath: string,
  config = getBunnyStorageConfig(),
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(buildUrl(config.storageEndpoint, objectPath), {
    method: "GET",
    headers: {
      AccessKey: config.storagePassword,
    },
  });

  if (!response.ok) {
    throw new BunnyStorageError(
      `Bunny Storage rejeitou a leitura com status ${response.status}.`,
      "BUNNY_DOWNLOAD_FAILED",
      response.status,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function deleteBunnyObject(
  objectPath: string,
  config = getBunnyStorageConfig(),
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(buildUrl(config.storageEndpoint, objectPath), {
    method: "DELETE",
    headers: {
      AccessKey: config.storagePassword,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new BunnyStorageError(
      `Bunny Storage rejeitou a remocao com status ${response.status}.`,
      "BUNNY_DELETE_FAILED",
      response.status,
    );
  }
}
