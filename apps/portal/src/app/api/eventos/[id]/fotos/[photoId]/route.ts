import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { PhotoOrigin } from "@/generated/prisma/client";
import { isCaptureMediaUrl } from "@/lib/capture-integration";
import { cacheCaptureThumbnail, isSafeMediaKey, readCachedCaptureThumbnail, readMediaVariant } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; photoId: string }> };

export const runtime = "nodejs";

const maxRemoteImageBytes = 15 * 1024 * 1024;
const remoteCacheSeconds = 30 * 24 * 60 * 60;
const allowedImageMimeTypes = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

function cacheHeaders(etag: string) {
  return { "Cache-Control": "private, no-cache", ETag: etag, "X-Content-Type-Options": "nosniff" };
}

function mediaEtag(value: string) {
  return `"${createHash("sha256").update(value).digest("base64url")}"`;
}

function notModified(request: Request, etag: string) {
  return request.headers.get("if-none-match")?.split(",").map((value) => value.trim()).includes(etag)
    ? new NextResponse(null, { status: 304, headers: cacheHeaders(etag) })
    : null;
}

async function remoteImage(url: string, etag: string, convertHeif = false, cacheThumbnail = false) {
  const sourceOrigin = new URL(process.env.CAPTURE_API_BASE_URL ?? "https://digax.productpulse.com.br").origin;
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const candidate = await fetch(url, {
        cache: "force-cache",
        next: { revalidate: remoteCacheSeconds },
        redirect: "error",
        signal: AbortSignal.timeout(6_000),
        // Bunny Stream protects video thumbnails against hotlinking. The proxy remains
        // owner-authorized and forwards the trusted album origin only to the validated CDN URL.
        headers: { Referer: `${sourceOrigin}/` },
      });
      if (candidate.ok || ![408, 429, 500, 502, 503, 504].includes(candidate.status) || attempt === 2) {
        response = candidate;
        break;
      }
      await candidate.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
  if (!response) throw lastError ?? new HttpError(404, "Mídia indisponível.");
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase() ?? "";
  const length = Number(response.headers.get("content-length") ?? 0);
  const canDecodeHeif = convertHeif && ["application/octet-stream", "image/heic", "image/heif"].includes(contentType);
  if (!response.ok || (!allowedImageMimeTypes.has(contentType) && !canDecodeHeif) || (Number.isFinite(length) && length > maxRemoteImageBytes) || !response.body) {
    await response.body?.cancel();
    throw new HttpError(404, "Mídia indisponível.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRemoteImageBytes) throw new HttpError(404, "Mídia indisponível.");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (convertHeif) {
    try {
      const decoder = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
      const metadata = await decoder.metadata();
      if (metadata.format !== "heif") throw new Error("Formato HEIF inválido.");
      const compatible = await decoder.rotate().webp({ quality: 92, effort: 4 }).toBuffer();
      return new NextResponse(compatible, { headers: { ...cacheHeaders(etag), "Content-Type": "image/webp" } });
    } catch { throw new HttpError(404, "Mídia indisponível."); }
  }
  if (cacheThumbnail) await cacheCaptureThumbnail(url, bytes, contentType).catch(() => {});
  return new NextResponse(bytes, { headers: { ...cacheHeaders(etag), "Content-Type": contentType } });
}

export async function GET(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser();
    const { id, photoId } = await params;
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, eventId: id, isVisible: true, event: { ownerId: user.id } },
      select: { origin: true, storageKey: true, originalStorageKey: true, originalMime: true, mime: true, width: true, height: true, remoteImageUrl: true, remoteThumbnailUrl: true, event: { select: { captureIntegration: { select: { sourceClientHash: true, sourceStoragePrefix: true } } } } },
    });

    if (!photo) throw new HttpError(404, "Foto não encontrada.");
    if (photo.origin === PhotoOrigin.CAPTURE) {
      const variant = new URL(request.url).searchParams.get("variante") ?? "original";
      if (variant !== "original" && variant !== "miniatura") throw new HttpError(400, "Variante de mídia inválida.");
      const originalIsBrowserUnsupported = /\.hei[cf](?:$|[?#])/i.test(photo.remoteImageUrl ?? "");
      const convertHeif = variant === "original" && originalIsBrowserUnsupported;
      const url = variant === "miniatura" ? photo.remoteThumbnailUrl ?? photo.remoteImageUrl : photo.remoteImageUrl ?? photo.remoteThumbnailUrl;
      if (!url || !isCaptureMediaUrl(url, { clientHash: photo.event.captureIntegration?.sourceClientHash, storagePrefix: photo.event.captureIntegration?.sourceStoragePrefix })) throw new HttpError(404, "Mídia indisponível.");
      const etag = mediaEtag(`capture:${variant}:${url}`);
      const cached = notModified(request, etag);
      if (cached) return cached;
      const localCache = variant === "miniatura" ? await readCachedCaptureThumbnail(url) : null;
      if (localCache) {
        return new NextResponse(new Uint8Array(localCache.bytes), { headers: { ...cacheHeaders(etag), "Content-Type": localCache.mime } });
      }
      try { return await remoteImage(url, etag, convertHeif, variant === "miniatura"); }
      catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(404, "Mídia indisponível."); }
    }

    if (!photo.storageKey || !isSafeMediaKey(photo.storageKey)) throw new HttpError(404, "Foto não encontrada.");
    const variant = new URL(request.url).searchParams.get("variante") ?? "original";
    if (variant !== "original" && variant !== "miniatura") throw new HttpError(400, "Variante de mídia inválida.");
    const useOriginal = variant === "original" && photo.originalStorageKey && isSafeMediaKey(photo.originalStorageKey);
    const responseKey = useOriginal ? photo.originalStorageKey! : photo.storageKey;
    const etag = mediaEtag(`local:${variant}:${responseKey}`);
    const cached = notModified(request, etag);
    if (cached) return cached;

    try {
      const image = useOriginal
        ? await readMediaVariant(photo.originalStorageKey!, "original", null, null)
        : await readMediaVariant(photo.storageKey, variant, photo.width, photo.height);
      return new NextResponse(new Uint8Array(image), {
        headers: {
          "Content-Type": useOriginal ? photo.originalMime ?? photo.mime : photo.mime,
          ...cacheHeaders(etag),
        },
      });
    } catch {
      throw new HttpError(404, "Foto não encontrada.");
    }
  });
}
