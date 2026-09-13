"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-api";
import { DashboardIcon } from "./dashboard-icon";

type Props = { eventId: string; lastSyncAt: string | null; className?: string };
export function CaptureSync({ eventId, lastSyncAt, className }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const running = useRef(false);
  const synchronize = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setLoading(true);
    try {
      const result = await requestJson<{ status: string; changed?: boolean; lastSyncAt?: string; message?: string }>(`/api/eventos/${eventId}/sincronizar`, { method: "POST" });
      setMessage(result.message ?? (result.status === "ready" ? "Álbum atualizado." : "Atualização em andamento."));
      if (result.status === "ready") {
        if (result.changed) router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar agora.");
    } finally { running.current = false; setLoading(false); }
  }, [eventId, router]);

  return <div className={className} aria-live="polite">
    <button type="button" onClick={() => void synchronize()} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}<DashboardIcon name="arrow" /></button>
    <span>{message ?? (lastSyncAt ? `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSyncAt))}` : "Aguardando a primeira sincronização.")}</span>
  </div>;
}
