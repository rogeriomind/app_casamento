import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const mediaRoot = process.env.MEDIA_DIR ?? path.join(process.cwd(), ".local", "media");

export function mediaPath(storageKey: string) {
  return path.join(/* turbopackIgnore: true */ mediaRoot, storageKey);
}

export function isSafeMediaKey(storageKey: string) {
  return storageKey === path.basename(storageKey) && /\.(?:jpe?g|png|webp)$/i.test(storageKey);
}

const captureThumbnailRoot = path.join(mediaRoot, "capture-thumbnails");
const captureThumbnailExtensions = ["avif", "jpg", "png", "webp"] as const;
const captureThumbnailMime = {
  avif: "image/avif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type CaptureThumbnailMime = typeof captureThumbnailMime[keyof typeof captureThumbnailMime];
type CachedCaptureThumbnail = { bytes: Buffer; mime: CaptureThumbnailMime };

const captureThumbnailReads = new Map<string, Promise<CachedCaptureThumbnail | null>>();
const captureThumbnailWrites = new Map<string, Promise<void>>();

function captureThumbnailId(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

function captureThumbnailExtension(mime: string): keyof typeof captureThumbnailMime | null {
  if (mime === "image/avif") return "avif";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

function importedCaptureId(url: string) {
  try {
    const filename = path.posix.basename(new URL(url).pathname);
    return filename.match(/^([0-9a-f-]{36})(?:-thumb)?\.(?:jpe?g|png|webp)$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function readImportedCaptureThumbnail(id: string): Promise<CachedCaptureThumbnail | null> {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importedMedia = new RegExp(`-${escapedId}\\.(?:jpe?g|png|webp)\\.webp$`, "i");
  try {
    const filename = (await readdir(/* turbopackIgnore: true */ mediaRoot)).find((name) => importedMedia.test(name));
    if (!filename) return null;
    try {
      return { bytes: await readFile(mediaPath(thumbnailKey(filename))), mime: "image/webp" };
    } catch {
      return { bytes: await readFile(mediaPath(filename)), mime: "image/webp" };
    }
  } catch {
    return null;
  }
}

/**
 * Thumbnails are the only Capture resources needed by the gallery grid. Keep a
 * private on-disk copy after the first owner-authorized fetch so the next visit
 * does not wait on the remote CDN again. Imported Capture files are also reused.
 */
export function readCachedCaptureThumbnail(url: string) {
  const running = captureThumbnailReads.get(url);
  if (running) return running;

  const read = (async (): Promise<CachedCaptureThumbnail | null> => {
    const importedId = importedCaptureId(url);
    if (importedId) {
      const imported = await readImportedCaptureThumbnail(importedId);
      if (imported) return imported;
    }

    const id = captureThumbnailId(url);
    for (const extension of captureThumbnailExtensions) {
      try {
        return { bytes: await readFile(path.join(/* turbopackIgnore: true */ captureThumbnailRoot, `${id}.${extension}`)), mime: captureThumbnailMime[extension] };
      } catch { /* Try the next supported cached format. */ }
    }
    return null;
  })();
  captureThumbnailReads.set(url, read);
  void read.finally(() => { if (captureThumbnailReads.get(url) === read) captureThumbnailReads.delete(url); });
  return read;
}

export function cacheCaptureThumbnail(url: string, bytes: Uint8Array, mime: string) {
  const extension = captureThumbnailExtension(mime);
  if (!extension) return Promise.resolve();
  const current = captureThumbnailWrites.get(url);
  if (current) return current;

  const write = (async () => {
    const id = captureThumbnailId(url);
    const filename = `${id}.${extension}`;
    await mkdir(/* turbopackIgnore: true */ captureThumbnailRoot, { recursive: true });
    await writeFile(path.join(/* turbopackIgnore: true */ captureThumbnailRoot, filename), bytes);
  })();
  captureThumbnailWrites.set(url, write);
  return write.finally(() => captureThumbnailWrites.delete(url));
}

const thumbnailMaxSize = 1200;
const thumbnailJobs = new Map<string, Promise<Buffer>>();
const captureVariantJobs = new Map<string, Promise<CachedCaptureThumbnail>>();

export function thumbnailKey(storageKey: string, requestedWidth = thumbnailMaxSize) {
  return storageKey.replace(/\.[^.]+$/i, `.thumbnail-${requestedWidth}.webp`);
}

export async function readMediaVariant(storageKey: string, variant: "original" | "miniatura", width: number | null, height: number | null, requestedWidth = thumbnailMaxSize) {
  if (variant === "original" || (width !== null && height !== null && width <= requestedWidth && height <= requestedWidth)) {
    return readFile(mediaPath(storageKey));
  }

  const key = thumbnailKey(storageKey, requestedWidth);
  try { return await readFile(mediaPath(key)); }
  catch {
    const running = thumbnailJobs.get(key);
    if (running) return running;
    const job = (async () => {
      const original = await readFile(mediaPath(storageKey));
      const thumbnail = await sharp(original, { limitInputPixels: 40_000_000, failOn: "error" })
        .resize({ width: requestedWidth, height: requestedWidth, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88, effort: 4 })
        .toBuffer();
      await writeFile(mediaPath(key), thumbnail);
      return thumbnail;
    })();
    thumbnailJobs.set(key, job);
    try { return await job; }
    finally { thumbnailJobs.delete(key); }
  }
}

export async function readCaptureThumbnailVariant(url: string, source: CachedCaptureThumbnail, requestedWidth: number) {
  const key = `${captureThumbnailId(url)}-${requestedWidth}.webp`;
  const target = path.join(/* turbopackIgnore: true */ captureThumbnailRoot, key);
  try { return { bytes: await readFile(target), mime: "image/webp" as const }; }
  catch {
    const running = captureVariantJobs.get(key);
    if (running) return running;
    const job = (async () => {
      const bytes = await sharp(source.bytes, { limitInputPixels: 40_000_000, failOn: "error" })
        .rotate()
        .resize({ width: requestedWidth, height: requestedWidth, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
      await mkdir(/* turbopackIgnore: true */ captureThumbnailRoot, { recursive: true });
      await writeFile(target, bytes);
      return { bytes, mime: "image/webp" as const };
    })();
    captureVariantJobs.set(key, job);
    try { return await job; }
    finally { captureVariantJobs.delete(key); }
  }
}
