import { PrismaClient } from "@prisma/client";
import { mkdir, copyFile, access } from "node:fs/promises";
import path from "node:path";
import {
  createClientHash,
  createClientStoragePrefix,
} from "../src/lib/client-identity";

const prisma = new PrismaClient();
const root = process.cwd();

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensurePublicAssets() {
  const assetDir = path.join(root, "public", "assets");
  await mkdir(assetDir, { recursive: true });

  const assets = ["nos.png", "flor.png", "flor2.png"];
  await Promise.all(
    assets.map(async (asset) => {
      const target = path.join(assetDir, asset);
      if (!(await exists(target))) {
        await copyFile(path.join(root, "img", asset), target);
      }
    }),
  );
}

async function main() {
  await ensurePublicAssets();

  const clientName = "Leticia e Rogerio";
  const clientNumber = "DEMO-LETICIA-ROGERIO";
  const clientHash = createClientHash(
    clientName,
    clientNumber,
    process.env.CLIENT_HASH_SECRET || "demo-client-hash-secret",
  );
  const storagePrefix = createClientStoragePrefix(clientHash);

  const event = await prisma.event.upsert({
    where: { clientNumber },
    update: {
      slug: "leticia-rogerio",
      clientName,
      clientHash,
      storagePrefix,
      name: "Galeria do Casamento",
      coupleName: "Leticia e Rogerio",
      monogram: "L+R",
      eventDate: new Date("2026-09-12T18:00:00.000Z"),
      isActive: true,
    },
    create: {
      slug: "leticia-rogerio",
      clientName,
      clientNumber,
      clientHash,
      storagePrefix,
      name: "Galeria do Casamento",
      coupleName: "Leticia e Rogerio",
      monogram: "L+R",
      eventDate: new Date("2026-09-12T18:00:00.000Z"),
      isActive: true,
    },
  });

  await prisma.guestSession.upsert({
    where: { id: "demo-leticia-rogerio" },
    update: {
      eventId: event.id,
      guestName: "Convidados",
      deviceId: "seed",
      lastSeenAt: new Date(),
    },
    create: {
      id: "demo-leticia-rogerio",
      eventId: event.id,
      guestName: "Convidados",
      deviceId: "seed",
      lastSeenAt: new Date(),
    },
  });

  await prisma.photo.deleteMany({
    where: {
      eventId: event.id,
      isDemo: true,
    },
  });

  await prisma.photo.deleteMany({
    where: {
      eventId: event.id,
      imageUrl: {
        not: {
          startsWith: `${process.env.BUNNY_PUBLIC_BASE_URL ?? "https://cdn.example.com"}/`,
        },
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
