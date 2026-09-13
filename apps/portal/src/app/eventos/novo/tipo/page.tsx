import { getOrCreateDraftForUser } from "@/lib/events";
import { requireVerifiedUser } from "@/lib/session";
import { TypeStep } from "@/features/events/components/event-wizard";

export default async function EventTypePage() {
  const user = await requireVerifiedUser();
  const draft = await getOrCreateDraftForUser(user.id);
  return <TypeStep draft={{ ...draft, eventDate: draft.eventDate?.toISOString() ?? null }} />;
}
