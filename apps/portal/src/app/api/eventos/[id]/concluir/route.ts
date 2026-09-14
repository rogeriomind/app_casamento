import { NextResponse } from "next/server";
import { z } from "zod";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { withOwnedEvent } from "@/lib/events";
import { albumColorSchema } from "@/lib/validation";
type Params = { params: Promise<{ id: string }> };
export function POST(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser(); const { id } = await params;
    const text = await request.text();
    const options = z.object({ useDefaults: z.boolean().optional(), albumColor: albumColorSchema.optional() }).parse(text ? JSON.parse(text) : {});
    const event = await withOwnedEvent(id, user.id, async (tx, current) => {
      if (current.state === "CREATED") return current;
      if (!current.type || !current.name?.trim() || !current.eventDate) {
        throw new HttpError(400, "Conclua o tipo, o nome e a data do evento antes de criar o álbum.");
      }
      return tx.event.update({ where: { id }, data: {
        state: "CREATED", name: current.name.trim(),
        ...(options.useDefaults ? { albumColor: "#17345f", coverPath: null, coverMime: null } : { albumColor: options.albumColor ?? current.albumColor }),
      } });
    });
    return NextResponse.json({ event });
  });
}
