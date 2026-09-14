import { redirect } from "next/navigation";
import { getDraftForUser } from "@/lib/events";
import { requireVerifiedUser } from "@/lib/session";
import { InformationStep } from "@/features/events/components/information-step";

export default async function EventInformationPage() {
  const user = await requireVerifiedUser(); const draft = await getDraftForUser(user.id);
  if (!draft?.type) redirect("/eventos/novo/tipo");
  return <InformationStep draft={{ ...draft, eventDate: draft.eventDate?.toISOString() ?? null }} />;
}
