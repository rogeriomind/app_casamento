import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };
const uploadRoot = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".local", "uploads");
const filePath = (file: string) => path.join(/* turbopackIgnore: true */ uploadRoot, file);

export function GET(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser();
    const { id } = await params;
    const event = await prisma.event.findFirst({ where: { id, ownerId: user.id }, select: { logoPath: true, logoMime: true } });
    if (!event?.logoPath || event.logoPath !== path.basename(event.logoPath)) throw new HttpError(404, "Logo não encontrado.");
    const etag = `"${createHash("sha256").update(event.logoPath).digest("base64url")}"`;
    const headers = { "Cache-Control": "private, no-cache", ETag: etag, "X-Content-Type-Options": "nosniff" };
    if (request.headers.get("if-none-match")?.split(",").map((value) => value.trim()).includes(etag)) {
      return new NextResponse(null, { status: 304, headers });
    }
    try {
      return new NextResponse(await readFile(filePath(event.logoPath)), {
        headers: { ...headers, "Content-Type": event.logoMime ?? "image/webp" },
      });
    } catch {
      throw new HttpError(404, "Logo não encontrado.");
    }
  });
}
