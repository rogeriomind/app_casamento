"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-api";
import { DashboardIcon } from "./dashboard-icon";

type Props = { eventId: string; lastSyncAt: string | null; className?: string };
const automaticSyncIntervalMs = 5 * 60_000;

export function CaptureSync({ eventId, lastSyncAt, className }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const running = useRef(false);
  const lastSuccessfulSync = useRef(lastSyncAt ? new Date(lastSyncAt).getTime() : 0);
  const synchronize = useCallback(async (force = false) => {
    if (running.current || document.visibilityState !== "visible") return;
    if (!force && Date.now() - lastSuccessfulSync.current < automaticSyncIntervalMs) return;
    running.current = true;
    setLoading(true);
    try {
      const result = await requestJson<{ status: string; changed?: boolean; lastSyncAt?: string; message?: string }>(`/api/eventos/${eventId}/sincronizar`, { method: "POST" });
      setMessage(result.message ?? (result.status === "ready" ? "Álbum atualizado." : "Atualização em andamento."));
      if (result.status === "ready") {
        lastSuccessfulSync.current = result.lastSyncAt ? new Date(result.lastSyncAt).getTime() : Date.now();
        if (result.changed) router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar agora.");
    } finally { running.current = false; setLoading(false); }
  }, [eventId, router]);

  useEffect(() => {
    void synchronize();
    const onVisibility = () => { if (document.visibilityState === "visible") void synchronize(); };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void synchronize(); }, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.clearInterval(timer); };
  }, [synchronize]);

  return <div className={className} aria-live="polite">
    <button type="button" onClick={() => void synchronize(true)} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}<DashboardIcon name="arrow" /></button>
    <span>{message ?? (lastSyncAt ? `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSyncAt))}` : "Atualização automática ativada.")}</span>
  </div>;
}
