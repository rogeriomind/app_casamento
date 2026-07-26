import type { Prisma } from "@prisma/client";

export const DEFAULT_GALLERY_PAGE_SIZE = 12;
export const MAX_GALLERY_PAGE_SIZE = 60;

export type GalleryCursor = {
  createdAt: string;
  id: string;
};

export function normalizeGalleryLimit(value: string | null) {
  const parsed = Number(value ?? DEFAULT_GALLERY_PAGE_SIZE);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GALLERY_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_GALLERY_PAGE_SIZE);
}

export function encodeGalleryCursor(photo: { createdAt: Date; id: string }) {
  return Buffer.from(
    JSON.stringify({
      createdAt: photo.createdAt.toISOString(),
      id: photo.id,
    } satisfies GalleryCursor),
  ).toString("base64url");
}

export function decodeGalleryCursor(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<GalleryCursor>;
    if (!parsed.createdAt || !parsed.id) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function buildGalleryCursorWhere(
  cursor: { createdAt: Date; id: string } | null,
): Prisma.PhotoWhereInput {
  if (!cursor) {
    return {};
  }

  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
