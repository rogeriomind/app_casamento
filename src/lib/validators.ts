import { z } from "zod";
import {
  normalizeClientName,
  normalizeClientNumber,
} from "@/lib/client-normalization";

export const MAX_IMAGE_SIZE_IN_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ACCEPTED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

const nameCharacters = /^[\p{L}\p{M}\s'.-]+$/u;

export function normalizeGuestName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export const guestNameSchema = z
  .string()
  .transform(normalizeGuestName)
  .pipe(
    z
      .string()
      .min(2, "Digite pelo menos 2 caracteres.")
      .max(80, "Use ate 80 caracteres.")
      .refine((value) => !/^\d+$/.test(value.replace(/\s/g, "")), {
        message: "Digite seu nome, nao apenas numeros.",
      })
      .refine((value) => nameCharacters.test(value), {
        message: "Use apenas letras, espacos e pontuacao simples.",
      }),
  );

export const clientNameSchema = z
  .string()
  .transform(normalizeClientName)
  .pipe(z.string().min(2, "Nome do cliente invalido.").max(120));

export const clientNumberSchema = z
  .string()
  .transform(normalizeClientNumber)
  .pipe(
    z
      .string()
      .min(2, "Codigo interno do cliente invalido.")
      .max(80)
      .regex(/^[A-Z0-9._-]+$/, "Use letras, numeros, pontos, hifens ou underscores."),
  );

export const albumNameSchema = z
  .string()
  .trim()
  .min(2, "Nome do album invalido.")
  .max(120);

export const coupleNameSchema = z
  .string()
  .trim()
  .min(2, "Nome do casal invalido.")
  .max(120);

export const monogramSchema = z.string().trim().min(1).max(16);

export type ImageFileInput = {
  name?: string;
  size: number;
  type?: string;
};

export function validateImageFileInput(file: ImageFileInput) {
  const mimeType = file.type?.toLowerCase() ?? "";
  const extension = file.name?.split(".").pop()?.toLowerCase() ?? "";

  if (
    !ACCEPTED_IMAGE_MIME_TYPES.has(mimeType) &&
    !ACCEPTED_IMAGE_EXTENSIONS.has(extension)
  ) {
    return {
      ok: false,
      code: "INVALID_FILE_TYPE",
      message: "Envie uma imagem JPG, PNG, WebP ou HEIC.",
    } as const;
  }

  if (file.size <= 0) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "A foto selecionada esta vazia.",
    } as const;
  }

  if (file.size > MAX_IMAGE_SIZE_IN_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "A foto precisa ter ate 25 MB.",
    } as const;
  }

  return { ok: true } as const;
}
