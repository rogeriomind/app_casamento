import { beforeEach, describe, expect, it } from "vitest";
import {
  getDeviceStorageKey,
  getOrCreateDeviceId,
  getSessionStorageKey,
  parseStoredGuestSession,
} from "@/lib/session-storage";

describe("guest session storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("scopes sessions by event", () => {
    expect(getSessionStorageKey("event_123")).toBe(
      "wedding-album:event_123:guest-session",
    );
  });

  it("parses a valid stored session", () => {
    expect(
      parseStoredGuestSession(
        JSON.stringify({
          guestSessionId: "guest_123",
          guestName: "Letícia",
        }),
      ),
    ).toEqual({
      guestSessionId: "guest_123",
      guestName: "Letícia",
    });
  });

  it("ignores invalid stored values", () => {
    expect(parseStoredGuestSession("{broken")).toBeNull();
    expect(parseStoredGuestSession(JSON.stringify({ guestName: "Ana" }))).toBeNull();
  });

  it("creates and reuses a stable device id", () => {
    const firstDeviceId = getOrCreateDeviceId();
    const secondDeviceId = getOrCreateDeviceId();

    expect(firstDeviceId).toBeTruthy();
    expect(secondDeviceId).toBe(firstDeviceId);
    expect(window.localStorage.getItem(getDeviceStorageKey())).toBe(firstDeviceId);
  });
});
