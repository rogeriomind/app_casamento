"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { jsonOptions, requestJson } from "@/lib/client-api";

export type Draft = { id: string; type: "WEDDING" | "BIRTHDAY" | "GRADUATION" | "GATHERING" | "CORPORATE" | "OTHER" | null; name: string | null; eventDate: string | null; description: string | null; albumColor: string; coverPath: string | null };
export function useDraft<T extends object>(id: string, section: string, initial: T) {
  const key = "nosso-album:draft:" + id + ":" + section;
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const pending = useRef<T | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const payload = pending.current;
    if (!payload) return queue.current;
    pending.current = null;
    setStatus("Salvando...");
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        await requestJson("/api/eventos/" + id, jsonOptions("PATCH", payload));
        setError(""); setStatus("Salvo");
        try { if (sessionStorage.getItem(key) === JSON.stringify(payload)) sessionStorage.removeItem(key); } catch {}
      } catch (e) {
        if (!pending.current) pending.current = payload;
        setError((e as Error).message); setStatus(""); throw e;
      }
    });
    return queue.current;
  }, [id, key]);
  const change = useCallback((next: T) => {
    setValue(next); pending.current = next; setError(""); setStatus("Salvando...");
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, 350);
  }, [key, flush]);
  useEffect(() => {
    try { const stored = sessionStorage.getItem(key); if (stored) change(JSON.parse(stored) as T); } catch {}
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [key, change]);
  return { value, change, flush, error, status };
}
