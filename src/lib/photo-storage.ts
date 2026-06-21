import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { deleteBunnyObject, uploadBunnyObject } from "@/lib/bunny-storage";
import { validateImageFileInput } from "@/lib/validators";

const VALID_SHARP_FORMATS = new Set(["jpeg", "jpg", "png", "webp", "heif"]);

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

export async function processAndStorePhoto(file: File, storagePrefix: string) {
  const basicValidation = validateImageFileInput(file);

  if (!basicValidation.ok) {
    throw new UploadValidationError(
      basicValidation.message,
      basicValidation.code,
      400,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    throw new UploadValidationError(
      "Não conseguimos ler essa imagem. Tente outra foto.",
      "INVALID_IMAGE_CONTENT",
      400,
    );
  }

  if (!metadata.format || !VALID_SHARP_FORMATS.has(metadata.format)) {
    throw new UploadValidationError(
      "Esse formato de imagem não pôde ser processado.",
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

  const basePipeline = sharp(buffer, { failOn: "error" }).rotate();

  const [imageBuffer, thumbnailBuffer] = await Promise.all([
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
