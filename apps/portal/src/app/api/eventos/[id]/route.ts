import { NextResponse } from "next/server";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { withOwnedEvent } from "@/lib/events";
import { draftPatchSchema } from "@/lib/validation";
type Params = { params: Promise<{ id: string }> };
export function PATCH(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    const user = await apiUser();
    const { id } = await params;
    const patch = draftPatchSchema.parse(await request.json());
    if (!Object.keys(patch).length) throw new HttpError(400, "Nada para atualizar.");
    const event = await withOwnedEvent(id, user.id, async (tx, current) => {
      if (current.state !== "DRAFT") throw new HttpError(409, "Este álbum já foi criado.");
      const { eventDate, ...rest } = patch;
      return tx.event.update({ where: { id }, data: {
        ...rest, ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(eventDate + "T12:00:00.000Z") : null } : {}),
      } });
    });
    return NextResponse.json({ event });
  });
}
