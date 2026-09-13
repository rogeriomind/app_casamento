import { redirect } from "next/navigation";
import { requireVerifiedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { draftDestination, getDraftForUser } from "@/lib/events";

export default async function LoggedInPage() {
  const user = await requireVerifiedUser();
  const draft = await getDraftForUser(user.id);
  if (draft) redirect(draftDestination(draft));
  // A ordem de criação não indica qual é o álbum principal: uma jornada de
  // teste ou um novo evento vazio poderia ocultar um álbum já preenchido.
  // Priorizamos o acervo disponível, sem depender de nome ou de IDs fixos.
  const album = await prisma.event.findFirst({
    where: { ownerId: user.id, state: "CREATED" },
    orderBy: [{ photos: { _count: "desc" } }, { createdAt: "desc" }],
    select: { id: true },
  });
  redirect(album ? `/eventos/${album.id}` : "/eventos/novo/tipo");
}
