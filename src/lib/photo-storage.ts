import { randomUUID } from "node:crypto";
import convertHeic from "heic-convert";
import sharp, { type Metadata } from "sharp";
import { deleteBunnyObject, uploadBunnyObject } from "@/lib/bunny-storage";
import {
  type ImageFileInput,
  validateImageFileInput,
} from "@/lib/validators";

export const IMMUTABLE_IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";
export const PHOTO_THUMBNAIL_MAX_DIMENSION = 720;
export const PHOTO_THUMBNAIL_QUALITY = 82;

const VALID_PROCESSABLE_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);
const DEFAULT_PHOTO_PROCESSING_CONCURRENCY = 2;
const TOLERANT_SHARP_OPTIONS = { failOn: "none" } as const;

type OriginalImageAsset = {
  extension: string;
  contentType: string;
};

type PreparedImage = {
  buffer: Buffer;
  metadata: Metadata;
  originalFormat?: string;
};

export type GeneratedPhotoThumbnail = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
  sizeInBytes: number;
};

export type UploadedPhotoThumbnail = {
  thumbnailUrl: string;
  thumbnailObjectPath: string;
  thumbnailSizeInBytes: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
};

let activePhotoProcessors = 0;
const waitingPhotoProcessors: Array<() => void> = [];

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function getPhotoProcessingConcurrency() {
  const value = Number(process.env.PHOTO_PROCESSING_CONCURRENCY);
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    return DEFAULT_PHOTO_PROCESSING_CONCURRENCY;
  }

  return value;
}

async function acquirePhotoProcessingSlot() {
  if (activePhotoProcessors < getPhotoProcessingConcurrency()) {
    activePhotoProcessors += 1;
    return;
  }

  await new Promise<void>((resolve) => waitingPhotoProcessors.push(resolve));
  activePhotoProcessors += 1;
}

function releasePhotoProcessingSlot() {
  activePhotoProcessors = Math.max(0, activePhotoProcessors - 1);
  const next = waitingPhotoProcessors.shift();
  if (next) {
    next();
  }
}

async function withPhotoProcessingSlot<T>(task: () => Promise<T>) {
  await acquirePhotoProcessingSlot();
  try {
    return await task();
  } finally {
    releasePhotoProcessingSlot();
  }
}

function cleanStoragePrefix(storagePrefix: string) {
  return storagePrefix.replace(/^\/+|\/+$/g, "");
}

function getSafeObjectBaseName(value: string) {
  return (
    value
      .trim()
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || randomUUID()
  );
}

function getFileExtension(file: Pick<ImageFileInput, "name">) {
  return file.name?.split(".").pop()?.toLowerCase() ?? "";
}

function isHeicLikeFile(file: Pick<ImageFileInput, "name" | "type">) {
  const mimeType = file.type?.toLowerCase() ?? "";
  const extension = getFileExtension(file);

  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    extension === "heic" ||
    extension === "heif"
  );
}

async function convertHeicToJpegBuffer(buffer: Buffer) {
  try {
    const converted = await convertHeic({
      buffer,
      format: "JPEG",
      quality: 0.9,
    });

    return Buffer.from(converted);
  } catch {
    throw new UploadValidationError(
      "Nao conseguimos converter essa foto HEIC. Tente enviar em JPG.",
      "UNSUPPORTED_HEIC_IMAGE",
      400,
    );
  }
}

function toImageProcessingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/premature end|corrupt|truncated|bad seek/i.test(message)) {
    return new UploadValidationError(
      "Essa foto parece estar incompleta ou corrompida. Tente reenviar a original.",
      "INVALID_IMAGE_CONTENT",
      400,
    );
  }

  if (/heif|heic/i.test(message)) {
    return new UploadValidationError(
      "Nao conseguimos processar essa foto HEIC. Tente enviar em JPG.",
      "UNSUPPORTED_HEIC_IMAGE",
      400,
    );
  }

  return new UploadValidationError(
    "Nao conseguimos processar essa imagem. Tente outra foto.",
    "INVALID_IMAGE_CONTENT",
    400,
  );
}

function validatePreparedImageMetadata(metadata: Metadata) {
  if (!metadata.format || !VALID_PROCESSABLE_FORMATS.has(metadata.format)) {
    throw new UploadValidationError(
      "Esse formato de imagem nao pode ser processado.",
      "UNSUPPORTED_IMAGE_FORMAT",
      400,
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new UploadValidationError(
      "A imagem parece estar corrompida.",
      "INVALID_IMAGE_DIMENSIONS",
      400,
    );
  }
}

async function prepareImageBuffer(
  buffer: Buffer,
  file: Pick<ImageFileInput, "name" | "type">,
): Promise<PreparedImage> {
  try {
    const metadata = await sharp(buffer, TOLERANT_SHARP_OPTIONS).metadata();
    if (metadata.format === "heif") {
      const convertedBuffer = await convertHeicToJpegBuffer(buffer);
      const convertedMetadata = await sharp(
        convertedBuffer,
        TOLERANT_SHARP_OPTIONS,
      ).metadata();

      return {
        buffer: convertedBuffer,
        metadata: convertedMetadata,
        originalFormat: metadata.format,
      };
    }

    return { buffer, metadata, originalFormat: metadata.format };
  } catch {
    if (!isHeicLikeFile(file)) {
      throw new UploadValidationError(
        "Nao conseguimos ler essa imagem. Tente outra foto.",
        "INVALID_IMAGE_CONTENT",
        400,
      );
    }

    const convertedBuffer = await convertHeicToJpegBuffer(buffer);
    const metadata = await sharp(
      convertedBuffer,
      TOLERANT_SHARP_OPTIONS,
    ).metadata();

    return { buffer: convertedBuffer, metadata, originalFormat: "heif" };
  }
}

function getOriginalImageAsset(
  file: Pick<ImageFileInput, "name" | "type">,
  originalFormat?: string,
): OriginalImageAsset {
  const extension = getFileExtension(file);
  const mimeType = file.type?.toLowerCase() ?? "";

  if (originalFormat === "heif") {
    if (extension === "heif" || mimeType === "image/heif") {
      return { extension: "heif", contentType: "image/heif" };
    }

    return { extension: "heic", contentType: "image/heic" };
  }

  if (originalFormat === "png") {
    return { extension: "png", contentType: "image/png" };
  }

  if (originalFormat === "webp") {
    return { extension: "webp", contentType: "image/webp" };
  }

  return {
    extension: extension === "jpeg" ? "jpeg" : "jpg",
    contentType: "image/jpeg",
  };
}

function buildPhotoObjectPath(
  storagePrefix: string,
  directory: "photos" | "thumbnails",
  fileName: string,
) {
  return `${cleanStoragePrefix(storagePrefix)}/${directory}/${fileName}`;
}

async function generateThumbnailFromPreparedBuffer(
  buffer: Buffer,
): Promise<GeneratedPhotoThumbnail> {
  try {
    const { data, info } = await withPhotoProcessingSlot(() =>
      sharp(buffer, TOLERANT_SHARP_OPTIONS)
        .rotate()
        .resize({
          width: PHOTO_THUMBNAIL_MAX_DIMENSION,
          height: PHOTO_THUMBNAIL_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: PHOTO_THUMBNAIL_QUALITY,
          effort: 4,
        })
        .toBuffer({ resolveWithObject: true }),
    );

    return {
      buffer: data,
      contentType: "image/webp",
      extension: "webp",
      width: info.width,
      height: info.height,
      sizeInBytes: data.byteLength,
    };
  } catch (error) {
    throw toImageProcessingError(error);
  }
}

export async function createPhotoThumbnail(
  buffer: Buffer,
  source: Pick<ImageFileInput, "name" | "type"> = {},
) {
  const preparedImage = await prepareImageBuffer(buffer, source);
  validatePreparedImageMetadata(preparedImage.metadata);

  return generateThumbnailFromPreparedBuffer(preparedImage.buffer);
}

export async function createAndUploadPhotoThumbnail(options: {
  originalBuffer: Buffer;
  storagePrefix: string;
  objectBaseName: string;
  source?: Pick<ImageFileInput, "name" | "type">;
}): Promise<UploadedPhotoThumbnail> {
  const thumbnail = await createPhotoThumbnail(
    options.originalBuffer,
    options.source,
  );
  const safeBaseName = getSafeObjectBaseName(options.objectBaseName);
  const thumbnailObjectPath = buildPhotoObjectPath(
    options.storagePrefix,
    "thumbnails",
    `${safeBaseName}-thumb.${thumbnail.extension}`,
  );
  const thumbnailUrl = await uploadBunnyObject(
    thumbnailObjectPath,
    thumbnail.buffer,
    {
      contentType: thumbnail.contentType,
      cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
    },
  );

  return {
    thumbnailUrl,
    thumbnailObjectPath,
    thumbnailSizeInBytes: thumbnail.sizeInBytes,
    thumbnailWidth: thumbnail.width,
    thumbnailHeight: thumbnail.height,
  };
}

export async function processAndStorePhoto(file: File, storagePrefix: string) {
  const basicValidation = validateImageFileInput(file);

  if (!basicValidation.ok) {
    throw new UploadValidationError(
      basicValidation.message,
      basicValidation.code,
      400,
    );
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const preparedImage = await prepareImageBuffer(originalBuffer, file);
  validatePreparedImageMetadata(preparedImage.metadata);

  const id = randomUUID();
  const originalAsset = getOriginalImageAsset(file, preparedImage.originalFormat);
  const imageObjectPath = buildPhotoObjectPath(
    storagePrefix,
    "photos",
    `${id}.${originalAsset.extension}`,
  );
  const thumbnailObjectPath = buildPhotoObjectPath(
    storagePrefix,
    "thumbnails",
    `${id}-thumb.webp`,
  );
  const thumbnail = await generateThumbnailFromPreparedBuffer(
    preparedImage.buffer,
  );

  let imageUploaded = false;

  try {
    const imageUrl = await uploadBunnyObject(imageObjectPath, originalBuffer, {
      contentType: originalAsset.contentType,
      cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
    });
    imageUploaded = true;
    const thumbnailUrl = await uploadBunnyObject(
      thumbnailObjectPath,
      thumbnail.buffer,
      {
        contentType: thumbnail.contentType,
        cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
      },
    );

    return {
      imageUrl,
      thumbnailUrl,
      imageObjectPath,
      thumbnailObjectPath,
      mimeType: originalAsset.contentType,
      sizeInBytes: originalBuffer.byteLength,
      originalFileName: file.name || null,
    };
  } catch (error) {
    if (imageUploaded) {
      try {
        await deleteBunnyObject(imageObjectPath);
      } catch (cleanupError) {
        console.warn("bunny_cleanup_failed", {
          storagePrefix: cleanStoragePrefix(storagePrefix),
          objectPath: imageObjectPath,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : cleanupError,
        });
      }
    }

    throw error;
  }
}
