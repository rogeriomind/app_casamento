"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearGuestSession,
  getOrCreateDeviceId,
  readGuestSession,
  saveGuestSession,
} from "@/lib/session-storage";
import type { PublicGuestSession } from "@/types";

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? "Algo nao saiu como esperado.";
}

export function useGuestSession(eventId: string) {
  const [session, setSession] = useState<PublicGuestSession | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    setSession(readGuestSession(eventId));
    setIsHydrated(true);
  }, [eventId]);

  const submitGuestName = useCallback(
    async (guestName: string) => {
      const currentDeviceId = deviceId ?? getOrCreateDeviceId();
      if (!currentDeviceId) {
        throw new Error("Nao foi possivel identificar este aparelho.");
      }
      setDeviceId(currentDeviceId);

      const response = await fetch(`/api/events/${eventId}/guest-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": currentDeviceId,
        },
        body: JSON.stringify({ guestName }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const nextSession = (await response.json()) as PublicGuestSession;
      saveGuestSession(eventId, nextSession);
      setSession(nextSession);
      return nextSession;
    },
    [deviceId, eventId],
  );

  const signOut = useCallback(() => {
    clearGuestSession(eventId);
    setSession(null);
  }, [eventId]);

  return {
    session,
    setSession,
    deviceId,
    isHydrated,
    submitGuestName,
    signOut,
  };
}
