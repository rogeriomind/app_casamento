import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { withOwnedEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const uploadRoot = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".local", "uploads");
const maxBytes = 5 * 1024 * 1024;
const filePath = (file: string) => path.join(/* turbopackIgnore: true */ uploadRoot, file);
const thumbnailJobs = new Map<string, Promise<Buffer>>();

function responseHeaders(etag: string) {
  return { "Cache-Control": "private, no-cache", ETag: etag, "X-Content-Type-Options": "nosniff" };
}

function etagFor(value: string) {
  return `"${createHash("sha256").update(value).digest("base64url")}"`;
}

async function readCover(filename: string, thumbnail: boolean) {
  if (!thumbnail) return readFile(filePath(filename));
  const thumbnailName = filename.replace(/\.webp$/i, ".thumbnail-320.webp");
  try { return await readFile(filePath(thumbnailName)); }
  catch {
    const running = thumbnailJobs.get(thumbnailName);
    if (running) return running;
    const job = (async () => {
      const image = await sharp(await readFile(filePath(filename)), { limitInputPixels: 40_000_000, failOn: "error" })
        .resize({ width: 320, height: 320, fit: "cover" })
        .webp({ quality: 88, effort: 4 })
        .toBuffer();
      await writeFile(filePath(thumbnailName), image);
      return image;
    })();
    thumbnailJobs.set(thumbnailName, job);
    try { return await job; }
    finally { thumbnailJobs.delete(thumbnailName); }
  }
}

export function POST(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser(); const { id } = await params;
    const owned = await prisma.event.findFirst({ where: { id, ownerId: user.id, state: "DRAFT" } });
    if (!owned) throw new HttpError(404, "Rascunho não encontrado.");
    if (Number(request.headers.get("content-length")) > maxBytes + 65536) throw new HttpError(400, "A capa deve ter no máximo 5 MB.");
    const form = await request.formData();
    const file = form.get("cover");
    if (!(file instanceof File) || !file.size) throw new HttpError(400, "Escolha uma imagem para a capa.");
    if (file.size > maxBytes) throw new HttpError(400, "A capa deve ter no máximo 5 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new HttpError(400, "Envie uma imagem JPG, PNG ou WEBP.");
    let image: Buffer;
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const decoder = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
      const metadata = await decoder.metadata();
      const mimeTypes: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
      const actualType = mimeTypes[metadata.format ?? ""];
      if (actualType !== file.type) throw new Error("Formato inválido");
      image = await decoder.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    } catch { throw new HttpError(400, "A imagem é inválida. Escolha um JPG, PNG ou WEBP válido."); }
    const filename = randomUUID() + ".webp";
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(filePath(filename), image);
    try {
      const event = await withOwnedEvent(id, user.id, async (tx, current) => {
        if (current.state !== "DRAFT") throw new HttpError(409, "Este álbum já foi criado.");
        return tx.event.update({ where: { id }, data: { coverPath: filename, coverMime: "image/webp" } });
      });
      return NextResponse.json({ event, coverUrl: "/api/eventos/" + id + "/capa?v=" + event.updatedAt.getTime() });
    } catch (error) { await unlink(filePath(filename)).catch(() => {}); throw error; }
  });
}
export function GET(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser(); const { id } = await params;
    const event = await prisma.event.findFirst({ where: { id, ownerId: user.id }, select: { coverPath: true, coverMime: true } });
    if (!event?.coverPath || event.coverPath !== path.basename(event.coverPath)) throw new HttpError(404, "Capa não encontrada.");
    const variant = new URL(request.url).searchParams.get("variante") ?? "original";
    if (variant !== "original" && variant !== "miniatura") throw new HttpError(400, "Variante de capa inválida.");
    const etag = etagFor(`${event.coverPath}:${variant}`);
    if (request.headers.get("if-none-match")?.split(",").map((value) => value.trim()).includes(etag)) {
      return new NextResponse(null, { status: 304, headers: responseHeaders(etag) });
    }
    try {
      const image = await readCover(event.coverPath, variant === "miniatura");
      return new NextResponse(new Uint8Array(image), { headers: { ...responseHeaders(etag), "Content-Type": event.coverMime ?? "image/webp" } });
    } catch { throw new HttpError(404, "Capa não encontrada."); }
  });
}
