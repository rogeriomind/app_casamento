import type { PublicGuestSession } from "@/types";

export function getSessionStorageKey(eventId: string) {
  return `wedding-album:${eventId}:guest-session`;
}

export function getDeviceStorageKey() {
  return "wedding-album:device-id";
}

function createDeviceId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return null;
  }

  const existingDeviceId = window.localStorage.getItem(getDeviceStorageKey());
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = createDeviceId();
  window.localStorage.setItem(getDeviceStorageKey(), deviceId);
  return deviceId;
}

export function parseStoredGuestSession(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PublicGuestSession>;
    if (
      typeof parsed.guestSessionId === "string" &&
      parsed.guestSessionId.length > 0 &&
      typeof parsed.guestName === "string" &&
      parsed.guestName.length > 0
    ) {
      return {
        guestSessionId: parsed.guestSessionId,
        guestName: parsed.guestName,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readGuestSession(eventId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStoredGuestSession(
    window.localStorage.getItem(getSessionStorageKey(eventId)),
  );
}

export function saveGuestSession(
  eventId: string,
  session: PublicGuestSession,
) {
  window.localStorage.setItem(
    getSessionStorageKey(eventId),
    JSON.stringify(session),
  );
}

export function clearGuestSession(eventId: string) {
  window.localStorage.removeItem(getSessionStorageKey(eventId));
}
