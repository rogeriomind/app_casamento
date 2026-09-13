import { redirect } from "next/navigation";
import { getDraftForUser } from "@/lib/events";
import { requireVerifiedUser } from "@/lib/session";
import { PersonalizationStep } from "@/features/events/components/personalization-step";

export default async function EventPersonalizationPage() {
  const user = await requireVerifiedUser(); const draft = await getDraftForUser(user.id);
  if (!draft?.type) redirect("/eventos/novo/tipo");
  if (!draft.name || !draft.eventDate) redirect("/eventos/novo/informacoes");
  return <PersonalizationStep draft={{ ...draft, eventDate: draft.eventDate.toISOString() }} />;
}
