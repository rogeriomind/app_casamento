import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadBunnyObject,
  getBunnyObjectPathFromPublicUrl,
} from "../src/lib/bunny-storage";
import { prisma } from "../src/lib/prisma";
import { createAndUploadPhotoThumbnail } from "../src/lib/photo-storage";

type CliOptions = {
  dryRun: boolean;
  limit?: number;
  batchSize: number;
  eventId?: string;
};

type BackfillStats = {
  scanned: number;
  candidates: number;
  backfilled: number;
  skipped: number;
  failed: number;
};

type BackfillPhoto = {
  id: string;
  eventId: string;
  imageUrl: string;
  imageObjectPath: string | null;
  thumbnailUrl: string | null;
  thumbnailObjectPath: string | null;
  originalFileName: string | null;
  mimeType: string;
  event: {
    storagePrefix: string;
  };
};

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...payload }));
}

export function parseBackfillArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, batchSize: 20 };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--limit deve ser um inteiro positivo.");
      }
      options.limit = value;
      index += 1;
    } else if (arg === "--batch-size") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0 || value > 100) {
        throw new Error("--batch-size deve ser um inteiro entre 1 e 100.");
      }
      options.batchSize = value;
      index += 1;
    } else if (arg === "--event-id") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--event-id precisa de um valor.");
      }
      options.eventId = value;
      index += 1;
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  return options;
}

function hasExistingThumbnail(photo: BackfillPhoto) {
  return Boolean(photo.thumbnailUrl && photo.thumbnailObjectPath);
}

async function downloadOriginalPhotoBuffer(photo: BackfillPhoto) {
  const objectPath =
    photo.imageObjectPath ?? getBunnyObjectPathFromPublicUrl(photo.imageUrl);

  if (objectPath) {
    return downloadBunnyObject(objectPath);
  }

  const response = await fetch(photo.imageUrl);
  if (!response.ok) {
    throw new Error(
      `Download publico falhou com status ${response.status} para ${photo.id}.`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function backfillPhoto(photo: BackfillPhoto, dryRun: boolean) {
  if (hasExistingThumbnail(photo)) {
    log("photo_thumbnail_backfill_skip_existing", { photoId: photo.id });
    return "skipped" as const;
  }

  log("photo_thumbnail_backfill_candidate", {
    photoId: photo.id,
    eventId: photo.eventId,
    dryRun,
  });

  if (dryRun) {
    return "skipped" as const;
  }

  const originalBuffer = await downloadOriginalPhotoBuffer(photo);
  const uploadedThumbnail = await createAndUploadPhotoThumbnail({
    originalBuffer,
    storagePrefix: photo.event.storagePrefix,
    objectBaseName: photo.id,
    source: {
      name:
        photo.originalFileName ??
        photo.imageObjectPath?.split("/").pop() ??
        photo.imageUrl.split("/").pop() ??
        photo.id,
      type: photo.mimeType,
    },
  });

  await prisma.photo.update({
    where: { id: photo.id },
    data: {
      thumbnailUrl: uploadedThumbnail.thumbnailUrl,
      thumbnailObjectPath: uploadedThumbnail.thumbnailObjectPath,
    },
  });

  log("photo_thumbnail_backfill_ok", {
    photoId: photo.id,
    thumbnailObjectPath: uploadedThumbnail.thumbnailObjectPath,
    thumbnailSizeInBytes: uploadedThumbnail.thumbnailSizeInBytes,
    thumbnailWidth: uploadedThumbnail.thumbnailWidth,
    thumbnailHeight: uploadedThumbnail.thumbnailHeight,
  });

  return "backfilled" as const;
}

export async function runBackfill(options: CliOptions) {
  const stats: BackfillStats = {
    scanned: 0,
    candidates: 0,
    backfilled: 0,
    skipped: 0,
    failed: 0,
  };
  let lastId: string | undefined;

  log("photo_thumbnail_backfill_start", {
    dryRun: options.dryRun,
    limit: options.limit ?? null,
    batchSize: options.batchSize,
    eventId: options.eventId ?? null,
  });

  while (options.limit === undefined || stats.scanned < options.limit) {
    const remaining =
      options.limit === undefined
        ? options.batchSize
        : Math.min(options.batchSize, options.limit - stats.scanned);
    if (remaining <= 0) {
      break;
    }

    const photos = await prisma.photo.findMany({
      where: {
        eventId: options.eventId,
        status: "published",
        id: lastId ? { gt: lastId } : undefined,
        OR: [
          { thumbnailUrl: null },
          { thumbnailUrl: "" },
          { thumbnailObjectPath: null },
          { thumbnailObjectPath: "" },
        ],
      },
      include: {
        event: {
          select: {
            storagePrefix: true,
          },
        },
      },
      orderBy: { id: "asc" },
      take: remaining,
    });

    if (photos.length === 0) {
      break;
    }

    lastId = photos[photos.length - 1]?.id;

    for (const photo of photos) {
      stats.scanned += 1;
      stats.candidates += 1;

      try {
        const result = await backfillPhoto(photo, options.dryRun);
        if (result === "backfilled") {
          stats.backfilled += 1;
        } else {
          stats.skipped += 1;
        }
      } catch (error) {
        stats.failed += 1;
        log("photo_thumbnail_backfill_failed", {
          photoId: photo.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  log("photo_thumbnail_backfill_report", stats);

  return stats;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBackfill(parseBackfillArgs(process.argv.slice(2)))
    .then((stats) => {
      if (stats.failed > 0) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      log("photo_thumbnail_backfill_fatal", {
        message: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
