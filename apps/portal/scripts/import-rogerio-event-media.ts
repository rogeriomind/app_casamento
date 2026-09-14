import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type SourcePhoto = {
  sourceKey: string;
  input: Buffer;
  altText: string;
  collection: string;
  sourceUrl: string;
  createdAt: Date;
};

type BunnyItem = {
  ObjectName: string;
  IsDirectory: boolean;
  Length: number;
  LastChanged: string;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não está configurada.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const mediaRoot = process.env.MEDIA_DIR ?? path.join(process.cwd(), ".local", "media");
const defaultEventPhotoPath = "clients/c617446da83643ac9826/casamento/photos";
const defaultImportLimit = 16;
const maxSourcePhotoBytes = 12 * 1024 * 1024;
const collectionLabels = ["Memórias do evento", "Momentos compartilhados", "Registros especiais"];

function storageConfig() {
  const endpoint = process.env.BUNNY_STORAGE_ENDPOINT?.trim().replace(/\/+$/, "");
  const password = process.env.BUNNY_STORAGE_PASSWORD?.trim();
  if (!endpoint || !password) return null;
  return {
    endpoint,
    password,
    eventPhotoPath: (process.env.BUNNY_IMPORT_EVENT_PATH?.trim() || defaultEventPhotoPath).replace(/^\/+|\/+$/g, ""),
    limit: Math.max(1, Math.min(Number(process.env.BUNNY_IMPORT_LIMIT) || defaultImportLimit, 60)),
  };
}

async function storageRequest(config: NonNullable<ReturnType<typeof storageConfig>>, objectPath: string) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${config.endpoint}/${encodedPath}`, {
        headers: { AccessKey: config.password },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response;
      lastError = new Error(`Storage respondeu com HTTP ${response.status}.`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Falha ao acessar o storage.");
    }
  }
  throw lastError ?? new Error("Falha ao acessar o storage.");
}

async function* bunnyPhotos(): AsyncGenerator<SourcePhoto> {
  const config = storageConfig();
  if (!config) return;
  const listing = await storageRequest(config, `${config.eventPhotoPath}/`);
  const items = await listing.json() as BunnyItem[];
  const files = items
    .filter((item) => !item.IsDirectory && item.Length > 0 && item.Length <= maxSourcePhotoBytes && /^[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(item.ObjectName))
    .sort((left, right) => new Date(right.LastChanged).getTime() - new Date(left.LastChanged).getTime())
    .slice(0, config.limit);

  if (!files.length) throw new Error("Nenhuma foto compatível foi encontrada na pasta configurada do storage.");
  for (const [index, file] of files.entries()) {
    const response = await storageRequest(config, `${config.eventPhotoPath}/${file.ObjectName}`);
    const input = Buffer.from(await response.arrayBuffer());
    const filename = path.posix.basename(file.ObjectName);
    yield {
      sourceKey: `bunny-${filename}`,
      input,
      altText: `Foto ${index + 1} importada do álbum colaborativo`,
      collection: collectionLabels[index % collectionLabels.length],
      sourceUrl: `bunny://${config.eventPhotoPath}/${filename}`,
      createdAt: new Date(file.LastChanged),
    };
  }
}

async function localFallbackPhotos(): Promise<SourcePhoto[]> {
  const sources = [
    { sourceKey: "product-party", relativePath: "public/images/login/party.png", altText: "Pessoas celebrando ao ar livre no fim de tarde", collection: "Celebração" },
    { sourceKey: "product-dinner", relativePath: "public/images/login/dinner.png", altText: "Mesa decorada para uma celebração ao entardecer", collection: "Encontro" },
    { sourceKey: "product-phone", relativePath: "public/images/login/phone.png", altText: "Pessoa registrando uma celebração com o celular", collection: "Bastidores" },
  ] as const;
  const createdAt = new Date();
  return Promise.all(sources.map(async (source) => ({
    ...source,
    input: await readFile(path.join(process.cwd(), source.relativePath)),
    sourceUrl: `local://${source.relativePath}`,
    createdAt,
  })));
}

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { equals: "Rogério", mode: "insensitive" }, emailVerified: true },
    select: { id: true, name: true },
  });
  if (users.length !== 1) throw new Error("Foi necessário encontrar exatamente um usuário confirmado chamado Rogério.");

  const targetEventId = process.env.MEDIA_IMPORT_EVENT_ID?.trim();
  const event = await prisma.event.findFirst({
    where: targetEventId
      ? { id: targetEventId, ownerId: users[0].id, state: "CREATED" }
      : { ownerId: users[0].id, state: "CREATED" },
    ...(targetEventId ? {} : { orderBy: { updatedAt: "desc" as const } }),
    select: { id: true, name: true },
  });
  if (!event) throw new Error("Rogério ainda não possui um álbum criado para receber as fotos.");

  const hasBunnyStorage = Boolean(storageConfig());
  const sources: AsyncIterable<SourcePhoto> | Iterable<SourcePhoto> = hasBunnyStorage ? bunnyPhotos() : await localFallbackPhotos();
  await mkdir(mediaRoot, { recursive: true });

  let syncedPhotos = 0;
  for await (const source of sources) {
    const sourceMetadata = await sharp(source.input, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
    const sourceFormats = {
      jpeg: { extension: "jpg", mime: "image/jpeg" },
      png: { extension: "png", mime: "image/png" },
      webp: { extension: "webp", mime: "image/webp" },
    } as const;
    const sourceFormat = sourceFormats[sourceMetadata.format as keyof typeof sourceFormats];
    if (!sourceFormat) throw new Error(`Formato original não suportado para ${source.sourceKey}.`);
    const result = await sharp(source.input, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    const storageKey = `${event.id}-${source.sourceKey}.webp`;
    const originalStorageKey = `${event.id}-${source.sourceKey}.original.${sourceFormat.extension}`;
    const thumbnailKey = storageKey.replace(/\.webp$/i, ".thumbnail-1200.webp");
    const thumbnail = await sharp(result.data, { limitInputPixels: 40_000_000, failOn: "error" })
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
    await Promise.all([
      writeFile(path.join(mediaRoot, storageKey), result.data),
      writeFile(path.join(mediaRoot, thumbnailKey), thumbnail),
      writeFile(path.join(mediaRoot, originalStorageKey), source.input),
    ]);
    await prisma.photo.upsert({
      where: { eventId_sourceKey: { eventId: event.id, sourceKey: source.sourceKey } },
      create: {
        eventId: event.id,
        storageKey,
        originalStorageKey,
        originalMime: sourceFormat.mime,
        mime: "image/webp",
        width: result.info.width,
        height: result.info.height,
        altText: source.altText,
        collection: source.collection,
        sourceKey: source.sourceKey,
        sourceUrl: source.sourceUrl,
        createdAt: source.createdAt,
      },
      update: {
        storageKey,
        originalStorageKey,
        originalMime: sourceFormat.mime,
        mime: "image/webp",
        width: result.info.width,
        height: result.info.height,
        altText: source.altText,
        collection: source.collection,
        sourceUrl: source.sourceUrl,
        createdAt: source.createdAt,
      },
    });
    syncedPhotos += 1;
  }

  if (hasBunnyStorage) {
    await prisma.photo.deleteMany({ where: { eventId: event.id, sourceKey: { startsWith: "product-" } } });
  }
  console.log(`Foram sincronizadas ${syncedPhotos} fotos ${hasBunnyStorage ? "do storage" : "locais"} para o álbum “${event.name ?? "Sem nome"}” de ${users[0].name}.`);
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha ao importar fotos.");
    process.exitCode = 1;
  });
