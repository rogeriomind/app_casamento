"use client";

import { useCallback, useEffect } from "react";
import type { PublicGuestSession } from "@/types";

const PRESENCE_INTERVAL_MS = 60_000;

export function useEventPresence({
  eventId,
  session,
  deviceId,
  enabled,
}: {
  eventId: string;
  session: PublicGuestSession | null;
  deviceId: string | null;
  enabled: boolean;
}) {
  const sendPresence = useCallback(async () => {
    if (!enabled || !session || !deviceId) {
      return;
    }

    await fetch(`/api/events/${eventId}/presence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
      },
      body: JSON.stringify({ guestSessionId: session.guestSessionId }),
    });
  }, [deviceId, enabled, eventId, session]);

  useEffect(() => {
    if (!enabled || !session || !deviceId) {
      return;
    }

    function heartbeat() {
      if (document.visibilityState === "visible") {
        void sendPresence().catch(() => undefined);
      }
    }

    heartbeat();
    const interval = window.setInterval(heartbeat, PRESENCE_INTERVAL_MS);
    document.addEventListener("visibilitychange", heartbeat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [deviceId, enabled, sendPresence, session]);

  return { sendPresence };
}
