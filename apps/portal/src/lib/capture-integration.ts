import "server-only";
import { randomUUID } from "node:crypto";
import { CaptureSyncStatus, MediaType, PhotoOrigin, type Prisma } from "@/generated/prisma/client";
import { HttpError } from "./http-error";
import { prisma } from "./prisma";

const DEFAULT_CAPTURE_BASE_URL = "https://digax.productpulse.com.br";
const pageLimit = 60;
const maxPages = 100;
const requestTimeoutMs = 10_000;
const syncBudgetMs = 45_000;
const minSyncIntervalMs = 15_000;
const leaseMs = 120_000;
const captureImageHosts = new Set((process.env.CAPTURE_MEDIA_HOSTS ?? "productpulse.b-cdn.net,vz-0656ab4c-f8c.b-cdn.net").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));

type RemotePhoto = {
  id: string;
  mediaType?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  videoEmbedUrl?: string | null;
  playbackUrl?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  guestName?: string | null;
  tags?: unknown;
  likeCount?: number | null;
  createdAt?: string | null;
};

type RemotePhotoPage = { items: RemotePhoto[]; hasNextPage: boolean; nextCursor: string | null };
type RemoteMetrics = { users?: { entered?: number | null }; guestSessions?: number | null; sessions?: number | null };
export type CaptureClientMetadata = { id: string; clientHash: string; storagePrefix: string; isActive: boolean };

export type CaptureSyncResult = {
  status: "ready" | "syncing" | "throttled";
  synced?: number;
  changed?: boolean;
  lastSyncAt?: Date | null;
  message?: string;
};

function captureBaseUrl() {
  const value = process.env.CAPTURE_API_BASE_URL ?? DEFAULT_CAPTURE_BASE_URL;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("CAPTURE_API_BASE_URL precisa usar HTTPS.");
  return url.origin;
}

function sourceUrl(path: string, baseUrl = captureBaseUrl()) {
  return new URL(path, `${baseUrl}/`).toString();
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string" || !tag.trim())) throw new Error("A origem retornou tags inválidas.");
  return [...new Set(value.map((tag) => tag.trim().toLocaleLowerCase("pt-BR")))];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nullableUrl(value: unknown, kind: "image" | "embed", clientHash?: string, storagePrefix?: string) {
  if (typeof value !== "string" || !value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || url.pathname.length > 2_000 || url.search.length > 1_000) throw new Error("A origem retornou uma URL de mídia inválida.");
  const host = url.hostname.toLowerCase();
  const isPlayer = host === "player.mediadelivery.net";
  const prefix = (storagePrefix ?? (clientHash ? `clients/${clientHash}` : "")).replace(/^\/+|\/+$/g, "");
  const prefixPattern = prefix ? escapeRegExp(prefix) : "a^";
  const clientPattern = clientHash ? escapeRegExp(clientHash) : "a^";
  const imagePathIsAllowed = host === "productpulse.b-cdn.net" && (
    new RegExp(`^/${prefixPattern}/(?:photos|thumbnails)/.+\\.(?:webp|jpe?g|png|avif|heic|heif)$`, "i").test(url.pathname)
    || new RegExp(`^/clients/${clientPattern}/(?:[A-Za-z0-9_-]+/)?(?:photos|thumbnails)/.+\\.(?:webp|jpe?g|png|avif|heic|heif)$`, "i").test(url.pathname)
  );
  const videoThumbnailIsAllowed = host === "vz-0656ab4c-f8c.b-cdn.net" && /^\/[0-9a-f-]+\/thumbnail\.(webp|jpe?g|png|avif)$/i.test(url.pathname);
  if (kind === "image" && (!captureImageHosts.has(host) || (!imagePathIsAllowed && !videoThumbnailIsAllowed))) throw new Error("A origem retornou uma imagem fora do CDN permitido.");
  if (kind === "embed" && !isPlayer) throw new Error("A origem retornou um player fora do domínio permitido.");
  return url.toString();
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function remoteCreatedAt(value: unknown) {
  if (typeof value !== "string") throw new Error("A origem retornou uma data inválida.");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("A origem retornou uma data inválida.");
  return parsed;
}

function validatePhoto(row: unknown): RemotePhoto {
  if (!row || typeof row !== "object") throw new Error("A origem retornou uma mídia inválida.");
  const photo = row as RemotePhoto;
  if (typeof photo.id !== "string" || !photo.id || (photo.mediaType !== "image" && photo.mediaType !== "video")) throw new Error("A origem retornou uma mídia inválida.");
  normalizeTags(photo.tags);
  remoteCreatedAt(photo.createdAt);
  if (typeof photo.likeCount !== "number" || !Number.isSafeInteger(photo.likeCount) || photo.likeCount < 0) throw new Error("A origem retornou curtidas inválidas.");
  if (photo.width !== null && photo.width !== undefined && optionalNumber(photo.width) === null) throw new Error("A origem retornou dimensões inválidas.");
  if (photo.height !== null && photo.height !== undefined && optionalNumber(photo.height) === null) throw new Error("A origem retornou dimensões inválidas.");
  if (photo.mediaType === "image" && typeof photo.imageUrl !== "string") throw new Error("A origem retornou uma foto incompleta.");
  if (photo.mediaType === "video" && (typeof photo.thumbnailUrl !== "string" || typeof photo.videoEmbedUrl !== "string" || optionalNumber(photo.durationSeconds) === null)) throw new Error("A origem retornou um vídeo incompleto.");
  return photo;
}

async function fetchJson<T>(url: string, init: RequestInit = {}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const signal = AbortSignal.timeout(requestTimeoutMs);
      const response = await fetch(url, { ...init, signal, cache: "no-store", redirect: "error" });
      if (!response.ok) throw new Error(`A captura respondeu com status ${response.status}.`);
      return await response.json() as T;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

export async function getCaptureClientMetadata(sourceClientHash: string, baseUrl = captureBaseUrl()): Promise<CaptureClientMetadata> {
  const key = process.env.CAPTURE_ADMIN_API_KEY;
  if (!key) throw new Error("CAPTURE_ADMIN_API_KEY não configurada.");
  const metadata = await fetchJson<Partial<CaptureClientMetadata>>(sourceUrl(`/api/admin/clients/${encodeURIComponent(sourceClientHash)}`, baseUrl), {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (typeof metadata.id !== "string" || metadata.id.length === 0 || metadata.clientHash !== sourceClientHash || typeof metadata.storagePrefix !== "string" || !metadata.storagePrefix || metadata.isActive !== true) {
    throw new Error("A captura retornou metadados de cliente inválidos ou inativos.");
  }
  return metadata as CaptureClientMetadata;
}

async function acquireLease(eventId: string, ownerId: string): Promise<{ token: string; integrationId: string } | CaptureSyncResult> {
  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT ci.id FROM "CaptureIntegration" ci INNER JOIN "Event" e ON e.id = ci."eventId" WHERE ci."eventId" = ${eventId} AND e."ownerId" = ${ownerId} FOR UPDATE`;
    const integration = await tx.captureIntegration.findFirst({
      where: { eventId, event: { ownerId } },
      select: { id: true, status: true, lastAttemptAt: true, lastSyncAt: true, leaseExpiresAt: true },
    });
    if (!integration) throw new HttpError(404, "Integração do álbum não encontrada.");
    const now = new Date();
    if (integration.leaseExpiresAt && integration.leaseExpiresAt > now) {
      return { status: "syncing", lastSyncAt: integration.lastSyncAt, message: "Uma atualização já está em andamento." };
    }
    if (integration.lastAttemptAt && now.getTime() - integration.lastAttemptAt.getTime() < minSyncIntervalMs) {
      return { status: "throttled", lastSyncAt: integration.lastSyncAt, message: "Aguarde alguns segundos para atualizar novamente." };
    }
    const token = randomUUID();
    await tx.captureIntegration.update({
      where: { id: integration.id },
      data: { status: CaptureSyncStatus.SYNCING, leaseToken: token, leaseExpiresAt: new Date(now.getTime() + leaseMs), lastAttemptAt: now, lastError: null },
    });
    return { token, integrationId: integration.id };
  });
}

async function fetchAllPhotos(sourceEventId: string, baseUrl: string) {
  const photos: RemotePhoto[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  const startedAt = Date.now();

  for (let page = 0; page < maxPages; page += 1) {
    if (Date.now() - startedAt > syncBudgetMs) throw new Error("A sincronização excedeu o tempo máximo.");
    const query = new URLSearchParams({ limit: String(pageLimit) });
    if (cursor) query.set("cursor", cursor);
    const payload = await fetchJson<RemotePhotoPage>(sourceUrl(`/api/events/${encodeURIComponent(sourceEventId)}/photos?${query}`, baseUrl));
    if (!Array.isArray(payload.items) || typeof payload.hasNextPage !== "boolean" || (payload.nextCursor !== null && (typeof payload.nextCursor !== "string" || !payload.nextCursor))) throw new Error("Resposta de mídias inválida.");
    if (payload.hasNextPage !== Boolean(payload.nextCursor)) throw new Error("A paginação da origem está inconsistente.");
    const rows = payload.items;
    for (const row of rows) {
      const photo = validatePhoto(row);
      if (ids.has(photo.id)) throw new Error("A origem retornou uma mídia duplicada.");
      ids.add(photo.id);
      photos.push(photo);
    }
    if (!payload.hasNextPage) return photos;
    const next = payload.nextCursor;
    if (!next) throw new Error("A paginação da origem está inconsistente.");
    if (cursors.has(next)) throw new Error("A origem repetiu o cursor da paginação.");
    cursors.add(next);
    cursor = next;
  }
  throw new Error("A origem excedeu o limite de páginas permitido.");
}

async function fetchMetrics(sourceClientHash: string, baseUrl: string): Promise<number | null> {
  const key = process.env.CAPTURE_ADMIN_API_KEY;
  if (!key) return null;
  const metrics = await fetchJson<RemoteMetrics>(sourceUrl(`/api/admin/clients/${encodeURIComponent(sourceClientHash)}/metrics`, baseUrl), {
    headers: { Authorization: `Bearer ${key}` },
  });
  return optionalNumber(metrics.users?.entered ?? metrics.guestSessions ?? metrics.sessions);
}

function remotePhotoData(row: RemotePhoto, eventId: string, sourceMetadata: CaptureClientMetadata) {
  const mediaType = row.mediaType === "video" ? MediaType.VIDEO : MediaType.IMAGE;
  const imageUrl = nullableUrl(row.imageUrl, "image", sourceMetadata.clientHash, sourceMetadata.storagePrefix);
  const thumbnailUrl = nullableUrl(row.thumbnailUrl, "image", sourceMetadata.clientHash, sourceMetadata.storagePrefix);
  const embedUrl = nullableUrl(row.videoEmbedUrl, "embed");
  const sourceTags = normalizeTags(row.tags);
  if (mediaType === MediaType.IMAGE && !imageUrl) throw new Error("A origem retornou uma foto sem URL.");
  if (mediaType === MediaType.VIDEO && (!thumbnailUrl || !embedUrl)) throw new Error("A origem retornou um vídeo incompleto.");
  return {
    eventId,
    origin: PhotoOrigin.CAPTURE,
    mediaType,
    storageKey: null,
    mime: mediaType === MediaType.VIDEO ? "video/mp4" : "image/webp",
    width: optionalNumber(row.width),
    height: optionalNumber(row.height),
    altText: mediaType === MediaType.VIDEO ? "Vídeo do casamento" : "Foto do casamento",
    collection: null,
    sourceKey: `capture:${sourceMetadata.id}:${row.id}`,
    sourceUrl: imageUrl ?? thumbnailUrl,
    remoteId: row.id,
    remoteImageUrl: imageUrl,
    remoteThumbnailUrl: thumbnailUrl,
    remoteEmbedUrl: embedUrl,
    remotePlaybackUrl: nullableUrl(row.playbackUrl, "embed"),
    authorName: typeof row.guestName === "string" && row.guestName.trim() ? row.guestName.trim().slice(0, 120) : null,
    sourceTags,
    tags: sourceTags,
    likeCount: row.likeCount!,
    durationSeconds: optionalNumber(row.durationSeconds),
    isVisible: true,
    missingSyncCount: 0,
    createdAt: remoteCreatedAt(row.createdAt),
  } satisfies Prisma.PhotoUncheckedCreateInput;
}

async function finishFailed(integrationId: string, token: string, error: unknown) {
  await prisma.captureIntegration.updateMany({
    where: { id: integrationId, leaseToken: token },
    data: { status: CaptureSyncStatus.FAILED, lastError: error instanceof Error ? error.message.slice(0, 500) : "Falha ao atualizar a captura.", leaseToken: null, leaseExpiresAt: null },
  });
}

export async function syncCaptureIntegration(eventId: string, ownerId: string): Promise<CaptureSyncResult> {
  const lease = await acquireLease(eventId, ownerId);
  if (!("token" in lease)) return lease;

  try {
    const integration = await prisma.captureIntegration.findUniqueOrThrow({
      where: { id: lease.integrationId },
      select: { sourceClientHash: true, sourceEventId: true, sourceBaseUrl: true, sourceStoragePrefix: true },
    });
    const sourceMetadata = await getCaptureClientMetadata(integration.sourceClientHash, integration.sourceBaseUrl);
    if (sourceMetadata.id !== integration.sourceEventId) throw new Error("O evento remoto não pertence ao cliente vinculado.");
    const sourceRows = await fetchAllPhotos(integration.sourceEventId, integration.sourceBaseUrl);
    const metricResult = await fetchMetrics(integration.sourceClientHash, integration.sourceBaseUrl).then((guestSessions) => ({ guestSessions, error: null as string | null })).catch(() => ({ guestSessions: null, error: "Mídias atualizadas; métricas indisponíveis." }));
    const mapped = sourceRows.map((row) => remotePhotoData(row, eventId, sourceMetadata));
    const seen = new Set(mapped.map((photo) => photo.remoteId).filter((id): id is string => !!id));
    const now = new Date();

    const completion = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CaptureIntegration" WHERE id = ${lease.integrationId} FOR UPDATE`;
      const current = await tx.captureIntegration.findFirst({ where: { id: lease.integrationId, leaseToken: lease.token, leaseExpiresAt: { gt: new Date() } } });
      if (!current) return { completed: false, changed: false };
      const stored = await tx.photo.findMany({
        where: { eventId, origin: PhotoOrigin.CAPTURE },
        select: {
          id: true, sourceKey: true, remoteId: true, mediaType: true, storageKey: true, mime: true,
          width: true, height: true, altText: true, collection: true, sourceUrl: true,
          remoteImageUrl: true, remoteThumbnailUrl: true, remoteEmbedUrl: true,
          remotePlaybackUrl: true, authorName: true, sourceTags: true, likeCount: true,
          durationSeconds: true, isVisible: true, missingSyncCount: true,
        },
      });
      const storedByKey = new Map(stored.map((photo) => [photo.sourceKey, photo]));
      const changedPhotos = mapped.filter((photo) => {
        const previous = storedByKey.get(photo.sourceKey);
        return !previous
          || previous.remoteId !== photo.remoteId
          || previous.mediaType !== photo.mediaType
          || previous.storageKey !== photo.storageKey
          || previous.mime !== photo.mime
          || previous.width !== photo.width
          || previous.height !== photo.height
          || previous.altText !== photo.altText
          || previous.collection !== photo.collection
          || previous.sourceUrl !== photo.sourceUrl
          || previous.remoteImageUrl !== photo.remoteImageUrl
          || previous.remoteThumbnailUrl !== photo.remoteThumbnailUrl
          || previous.remoteEmbedUrl !== photo.remoteEmbedUrl
          || previous.remotePlaybackUrl !== photo.remotePlaybackUrl
          || previous.authorName !== photo.authorName
          || previous.sourceTags.length !== photo.sourceTags.length
          || previous.sourceTags.some((tag, index) => tag !== photo.sourceTags[index])
          || previous.likeCount !== photo.likeCount
          || previous.durationSeconds !== photo.durationSeconds
          || !previous.isVisible
          || previous.missingSyncCount !== 0;
      });
      for (const photo of changedPhotos) {
        const { tags: _localTags, ...remoteUpdate } = photo;
        await tx.photo.upsert({
          where: { eventId_sourceKey: { eventId, sourceKey: photo.sourceKey } },
          create: photo,
          update: { ...remoteUpdate, eventId: undefined, createdAt: undefined },
        });
      }
      const existing = stored.filter((photo) => photo.remoteId && !seen.has(photo.remoteId) && photo.missingSyncCount < 2);
      for (const photo of existing) {
        const missingSyncCount = photo.missingSyncCount + 1;
        await tx.photo.update({ where: { id: photo.id }, data: { missingSyncCount, isVisible: missingSyncCount < 2 } });
      }
      const metricsChanged = metricResult.guestSessions !== null && metricResult.guestSessions !== current.remoteGuestSessions;
      const changed = changedPhotos.length > 0 || existing.length > 0 || metricsChanged;
      await tx.captureIntegration.update({
        where: { id: current.id },
        data: {
          status: CaptureSyncStatus.READY,
          lastSyncAt: now,
          lastError: metricResult.error,
          sourceStoragePrefix: sourceMetadata.storagePrefix,
          leaseToken: null,
          leaseExpiresAt: null,
          ...(metricResult.guestSessions === null ? {} : { remoteGuestSessions: metricResult.guestSessions, remoteMetricsAt: now }),
        },
      });
      return { completed: true, changed };
    });
    if (!completion.completed) return { status: "syncing", message: "A atualização foi substituída por outra execução." };
    return {
      status: "ready",
      synced: mapped.length,
      changed: completion.changed,
      lastSyncAt: now,
      message: metricResult.error ?? (completion.changed ? "Álbum atualizado." : "Álbum já está atualizado."),
    };
  } catch (error) {
    await finishFailed(lease.integrationId, lease.token, error);
    throw error;
  }
}

export function isCaptureMediaUrl(value: string | null | undefined, context: { clientHash?: string | null; storagePrefix?: string | null } = {}) {
  try { return !!nullableUrl(value, "image", context.clientHash ?? undefined, context.storagePrefix ?? undefined); } catch { return false; }
}
