import "dotenv/config";
import { createHash } from "node:crypto";
import {
  BunnyStorageError,
  downloadBunnyObject,
  getBunnyPublicUrl,
  headBunnyObject,
  uploadBunnyObject,
  type BunnyStorageConfig,
} from "../src/lib/bunny-storage";
import { validateBunnyStorageEnv } from "../src/lib/env";
import { prisma } from "../src/lib/prisma";

type CliOptions = {
  dryRun: boolean;
  limit?: number;
  eventId?: string;
  resume: boolean;
};

type MigrationStats = {
  processed: number;
  migrated: number;
  skipped: number;
  failed: number;
  missingObjects: number;
  recordsWithoutObjectPath: number;
};

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...payload }));
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, resume: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--resume") {
      options.resume = true;
    } else if (arg === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--limit deve ser um inteiro positivo.");
      }
      options.limit = value;
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

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} nao definido.`);
  }
  return value.replace(/\/+$/, "");
}

function readOldBunnyConfig(): BunnyStorageConfig {
  return {
    storageEndpoint: readRequiredEnv("BUNNY_OLD_STORAGE_ENDPOINT"),
    storagePassword: readRequiredEnv("BUNNY_OLD_STORAGE_PASSWORD"),
    publicBaseUrl: readRequiredEnv("BUNNY_OLD_PUBLIC_BASE_URL"),
  };
}

async function verifyExists(objectPath: string, config: BunnyStorageConfig) {
  try {
    await headBunnyObject(objectPath, config);
    return true;
  } catch (error) {
    if (error instanceof BunnyStorageError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

async function copyAndVerifyObject(
  objectPath: string,
  oldConfig: BunnyStorageConfig,
  newConfig: BunnyStorageConfig,
) {
  const buffer = await downloadBunnyObject(objectPath, oldConfig);
  const sourceHash = createHash("sha256").update(buffer).digest("hex");
  await uploadBunnyObject(objectPath, buffer, { config: newConfig });
  const copied = await downloadBunnyObject(objectPath, newConfig);
  const copiedHash = createHash("sha256").update(copied).digest("hex");

  if (sourceHash !== copiedHash) {
    throw new Error(`Checksum divergente para ${objectPath}.`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const oldConfig = readOldBunnyConfig();
  const newConfig = validateBunnyStorageEnv();
  const stats: MigrationStats = {
    processed: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    missingObjects: 0,
    recordsWithoutObjectPath: 0,
  };

  log("bunny_migration_start", {
    dryRun: options.dryRun,
    limit: options.limit ?? null,
    eventId: options.eventId ?? null,
    resume: options.resume,
  });

  const photos = await prisma.photo.findMany({
    where: {
      eventId: options.eventId,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: options.limit,
  });

  for (const photo of photos) {
    stats.processed += 1;

    try {
      const paths = [
        { kind: "image", objectPath: photo.imageObjectPath },
        { kind: "thumbnail", objectPath: photo.thumbnailObjectPath },
      ] as const;
      const availablePaths = paths.filter(
        (item): item is { kind: "image" | "thumbnail"; objectPath: string } =>
          Boolean(item.objectPath),
      );

      if (availablePaths.length === 0) {
        stats.recordsWithoutObjectPath += 1;
        stats.skipped += 1;
        log("bunny_migration_skip_no_object_path", { photoId: photo.id });
        continue;
      }

      if (
        options.resume &&
        photo.imageObjectPath &&
        photo.imageUrl === getBunnyPublicUrl(photo.imageObjectPath, newConfig) &&
        (!photo.thumbnailObjectPath ||
          photo.thumbnailUrl === getBunnyPublicUrl(photo.thumbnailObjectPath, newConfig))
      ) {
        stats.skipped += 1;
        log("bunny_migration_skip_already_current", { photoId: photo.id });
        continue;
      }

      for (const item of availablePaths) {
        const exists = await verifyExists(item.objectPath, oldConfig);
        if (!exists) {
          stats.missingObjects += 1;
          throw new Error(`Objeto ausente na origem: ${item.objectPath}`);
        }

        if (!options.dryRun) {
          await copyAndVerifyObject(item.objectPath, oldConfig, newConfig);
        }
      }

      if (!options.dryRun) {
        await prisma.$transaction(async (tx) => {
          await tx.photo.update({
            where: { id: photo.id },
            data: {
              imageUrl: photo.imageObjectPath
                ? getBunnyPublicUrl(photo.imageObjectPath, newConfig)
                : photo.imageUrl,
              thumbnailUrl: photo.thumbnailObjectPath
                ? getBunnyPublicUrl(photo.thumbnailObjectPath, newConfig)
                : photo.thumbnailUrl,
            },
          });
        });
      }

      stats.migrated += options.dryRun ? 0 : 1;
      stats.skipped += options.dryRun ? 1 : 0;
      log("bunny_migration_photo_ok", {
        photoId: photo.id,
        dryRun: options.dryRun,
      });
    } catch (error) {
      stats.failed += 1;
      log("bunny_migration_photo_failed", {
        photoId: photo.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log("bunny_migration_report", stats);

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    log("bunny_migration_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
