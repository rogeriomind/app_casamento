import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { withOwnedEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { eventSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };
type ImageField = "cover" | "logo";

const uploadRoot = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".local", "uploads");
const maxImageBytes = 5 * 1024 * 1024;
const filePath = (file: string) => path.join(/* turbopackIgnore: true */ uploadRoot, file);
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const actualTypes: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" };

async function normalizeImage(file: FormDataEntryValue | null, label: string) {
  if (file === null) return null;
  if (!(file instanceof File) || !file.size) throw new HttpError(400, `Escolha uma imagem válida para ${label}.`);
  if (file.size > maxImageBytes) throw new HttpError(400, `${label} deve ter no máximo 5 MB.`);
  if (!acceptedTypes.has(file.type)) throw new HttpError(400, `Envie ${label} em JPG, PNG, WEBP ou SVG.`);

  try {
    const decoder = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await decoder.metadata();
    if (actualTypes[metadata.format ?? ""] !== file.type) throw new Error("Formato inválido");
    return await decoder
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new HttpError(400, `${label} é inválido. Escolha uma imagem válida.`);
  }
}

export function PUT(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser();
    const { id } = await params;
    const owned = await prisma.event.findFirst({ where: { id, ownerId: user.id, state: "CREATED" }, select: { id: true } });
    if (!owned) throw new HttpError(404, "Álbum não encontrado.");
    if (Number(request.headers.get("content-length")) > maxImageBytes * 2 + 256 * 1024) throw new HttpError(400, "As imagens devem somar no máximo 10 MB.");

    const form = await request.formData();
    const settings = eventSettingsSchema.parse({
      displayNames: form.get("displayNames") ?? "",
      name: form.get("name") ?? "",
      eventDate: form.get("eventDate") ?? "",
      eventTime: form.get("eventTime") ?? "",
      venue: form.get("venue") ?? "",
      albumColor: form.get("albumColor"),
      albumStyle: form.get("albumStyle"),
      welcomeMessage: form.get("welcomeMessage") ?? "",
    });
    const [cover, logo] = await Promise.all([
      normalizeImage(form.get("cover"), "a capa"),
      normalizeImage(form.get("logo"), "o logo"),
    ]);

    const uploaded: Partial<Record<ImageField, string>> = {};
    try {
      if (cover || logo) await mkdir(uploadRoot, { recursive: true });
      for (const [field, image] of [["cover", cover], ["logo", logo]] as const) {
        if (!image) continue;
        const filename = `${randomUUID()}.webp`;
        await writeFile(filePath(filename), image);
        uploaded[field] = filename;
      }

      const event = await withOwnedEvent(id, user.id, async (tx, current) => {
        if (current.state !== "CREATED") throw new HttpError(409, "Este álbum ainda não foi criado.");
        return tx.event.update({
          where: { id },
          data: {
            displayNames: settings.displayNames || null,
            name: settings.name,
            eventDate: new Date(`${settings.eventDate}T12:00:00.000Z`),
            eventTime: settings.eventTime || null,
            venue: settings.venue || null,
            albumColor: settings.albumColor,
            albumStyle: settings.albumStyle,
            welcomeMessage: settings.welcomeMessage || null,
            ...(uploaded.cover ? { coverPath: uploaded.cover, coverMime: "image/webp" } : {}),
            ...(uploaded.logo ? { logoPath: uploaded.logo, logoMime: "image/webp" } : {}),
          },
        });
      });
      return NextResponse.json({
        event,
        coverUrl: uploaded.cover ? `/api/eventos/${id}/capa?v=${event.updatedAt.getTime()}` : null,
        logoUrl: uploaded.logo ? `/api/eventos/${id}/logo?v=${event.updatedAt.getTime()}` : null,
      });
    } catch (error) {
      await Promise.all(Object.values(uploaded).map((filename) => unlink(filePath(filename!)).catch(() => {})));
      throw error;
    }
  });
}
