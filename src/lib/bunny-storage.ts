import { createHash } from "node:crypto";

export type BunnyStorageConfig = {
  storageEndpoint: string;
  storagePassword: string;
  publicBaseUrl: string;
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

function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeObjectPath(objectPath: string) {
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
  return `${trimTrailingSlashes(baseUrl)}/${normalizeObjectPath(objectPath)}`;
}

export function getBunnyStorageConfig(): BunnyStorageConfig {
  const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT?.trim();
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD?.trim();
  const publicBaseUrl = getBunnyPublicBaseUrl();

  if (!storageEndpoint || !storagePassword) {
    throw new BunnyStorageError(
      "Bunny Storage nao esta configurado.",
      "BUNNY_STORAGE_NOT_CONFIGURED",
    );
  }

  return {
    storageEndpoint: trimTrailingSlashes(storageEndpoint),
    storagePassword,
    publicBaseUrl,
  };
}

export function getBunnyPublicBaseUrl() {
  const publicBaseUrl = process.env.BUNNY_PUBLIC_BASE_URL?.trim();

  if (!publicBaseUrl) {
    throw new BunnyStorageError(
      "URL publica do Bunny nao esta configurada.",
      "BUNNY_PUBLIC_BASE_URL_NOT_CONFIGURED",
    );
  }

  return trimTrailingSlashes(publicBaseUrl);
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
  config = getBunnyStorageConfig(),
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(buildUrl(config.storageEndpoint, objectPath), {
    method: "PUT",
    headers: {
      AccessKey: config.storagePassword,
      "Content-Type": "application/octet-stream",
      Checksum: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
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
