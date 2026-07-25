import { randomUUID } from "node:crypto";
import convertHeic from "heic-convert";
import sharp from "sharp";
import { deleteBunnyObject, uploadBunnyObject } from "@/lib/bunny-storage";
import { validateImageFileInput } from "@/lib/validators";

const VALID_SHARP_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);
const DEFAULT_PHOTO_PROCESSING_CONCURRENCY = 2;
const TOLERANT_SHARP_OPTIONS = { failOn: "none" } as const;

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

function getFileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function isHeicLikeFile(file: File) {
  const mimeType = file.type.toLowerCase();
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

async function prepareImageBuffer(buffer: Buffer, file: File) {
  try {
    const metadata = await sharp(buffer, TOLERANT_SHARP_OPTIONS).metadata();
    return { buffer, metadata };
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

    return { buffer: convertedBuffer, metadata };
  }
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

  const preparedImage = await prepareImageBuffer(
    Buffer.from(await file.arrayBuffer()),
    file,
  );
  let { buffer, metadata } = preparedImage;

  if (metadata.format === "heif") {
    buffer = await convertHeicToJpegBuffer(buffer);
    metadata = await sharp(buffer, TOLERANT_SHARP_OPTIONS).metadata();
  }

  if (!metadata.format || !VALID_SHARP_FORMATS.has(metadata.format)) {
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

  const id = randomUUID();
  const imageFileName = `${id}.jpg`;
  const thumbnailFileName = `${id}-thumb.jpg`;
  const cleanStoragePrefix = storagePrefix.replace(/^\/+|\/+$/g, "");
  const imageObjectPath = `${cleanStoragePrefix}/photos/${imageFileName}`;
  const thumbnailObjectPath = `${cleanStoragePrefix}/thumbnails/${thumbnailFileName}`;

  let imageBuffer: Buffer;
  let thumbnailBuffer: Buffer;

  try {
    [imageBuffer, thumbnailBuffer] = await withPhotoProcessingSlot(() => {
      const basePipeline = sharp(buffer, TOLERANT_SHARP_OPTIONS).rotate();

      return Promise.all([
        basePipeline
          .clone()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 86, mozjpeg: true })
          .toBuffer(),
        basePipeline
          .clone()
          .resize({ width: 520, height: 680, fit: "cover" })
          .jpeg({ quality: 78, mozjpeg: true })
          .toBuffer(),
      ]);
    });
  } catch (error) {
    throw toImageProcessingError(error);
  }

  let imageUploaded = false;

  try {
    const imageUrl = await uploadBunnyObject(imageObjectPath, imageBuffer);
    imageUploaded = true;
    const thumbnailUrl = await uploadBunnyObject(
      thumbnailObjectPath,
      thumbnailBuffer,
    );

    return {
      imageUrl,
      thumbnailUrl,
      imageObjectPath,
      thumbnailObjectPath,
      mimeType: "image/jpeg",
      sizeInBytes: imageBuffer.byteLength,
      originalFileName: file.name || null,
    };
  } catch (error) {
    if (imageUploaded) {
      try {
        await deleteBunnyObject(imageObjectPath);
      } catch (cleanupError) {
        console.warn("bunny_cleanup_failed", {
          storagePrefix: cleanStoragePrefix,
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
