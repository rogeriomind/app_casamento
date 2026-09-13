import type { CSSProperties, ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { EventState } from "@/generated/prisma/client";
import { AlbumSidebar } from "@/features/dashboard/components/album-sidebar";
import { getOwnedEvent } from "@/lib/owned-event";
import { requireVerifiedUser } from "@/lib/session";
import styles from "./layout.module.css";

export default async function AlbumLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requireVerifiedUser(), params]);
  const event = await getOwnedEvent(id, user.id);
  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");

  return (
    <div className={styles.shell} style={{ "--album-color": event.albumColor } as CSSProperties}>
      <AlbumSidebar eventId={event.id} userName={user.name} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
