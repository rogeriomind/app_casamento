export const POPULAR_TAGS = [
  "noivos",
  "festa",
  "pista",
  "amor",
  "familia",
  "amigos",
];

export const MAX_PHOTO_TAGS = 5;

export function normalizeTag(value: string) {
  return value
    .trim()
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePhotoTags(values: string[]) {
  const tags: string[] = [];

  for (const value of values) {
    const tag = normalizeTag(value);
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }

    if (tags.length === MAX_PHOTO_TAGS) {
      break;
    }
  }

  return tags;
}

export function parsePhotoTagsInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return normalizePhotoTags(
        parsed.filter((tag): tag is string => typeof tag === "string"),
      );
    }
  } catch {
    return normalizePhotoTags(value.split(","));
  }

  return [];
}
