import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  guestSession: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { POST } from "./route";

function createRequest(deviceId = "device-1") {
  return new Request("http://localhost/api/events/event-1/guest-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": deviceId,
    },
    body: JSON.stringify({ guestName: "Ana Silva" }),
  });
}

const context = {
  params: Promise.resolve({ eventKey: "event-1" }),
};

describe("POST /api/events/[eventKey]/guest-sessions", () => {
  beforeEach(() => {
    prismaMock.event.findUnique.mockReset();
    prismaMock.guestSession.upsert.mockReset();
  });

  it("upserts a guest session by event and device", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.upsert.mockResolvedValueOnce({
      id: "session-1",
      guestName: "Ana Silva",
    });

    const response = await POST(createRequest(), context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.guestSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId_deviceId: {
            eventId: "event-1",
            deviceId: "device-1",
          },
        },
        update: expect.objectContaining({
          guestName: "Ana Silva",
          lastSeenAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          eventId: "event-1",
          guestName: "Ana Silva",
          deviceId: "device-1",
        }),
      }),
    );
    expect(data).toEqual({
      guestSessionId: "session-1",
      guestName: "Ana Silva",
    });
  });

  it("requires a device id", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });

    const response = await POST(createRequest(""), context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({ code: "MISSING_DEVICE_ID" });
    expect(prismaMock.guestSession.upsert).not.toHaveBeenCalled();
  });
});
