import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  guestSession: {
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { POST } from "./route";

function createRequest(deviceId = "device-1", guestSessionId = "session-1") {
  return new Request("http://localhost/api/events/event-1/presence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": deviceId,
    },
    body: JSON.stringify({ guestSessionId }),
  });
}

const context = {
  params: Promise.resolve({ eventKey: "event-1" }),
};

describe("POST /api/events/[eventKey]/presence", () => {
  beforeEach(() => {
    prismaMock.event.findUnique.mockReset();
    prismaMock.guestSession.updateMany.mockReset();
  });

  it("updates lastSeenAt for the guest session and device", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const response = await POST(createRequest(), context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ ok: true });
    expect(prismaMock.guestSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "session-1",
          eventId: "event-1",
          deviceId: "device-1",
        },
        data: { lastSeenAt: expect.any(Date) },
      }),
    );
  });

  it("rejects a session that does not match the device", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: "event-1",
      isActive: true,
    });
    prismaMock.guestSession.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(createRequest(), context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toMatchObject({ code: "INVALID_SESSION" });
  });
});
