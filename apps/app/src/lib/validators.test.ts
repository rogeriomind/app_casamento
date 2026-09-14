import { describe, expect, it } from "vitest";
import {
  clientNumberSchema,
  guestNameSchema,
  normalizeGuestName,
  validateImageFileInput,
  validateVideoFileInput,
} from "@/lib/validators";

describe("guest name validation", () => {
  it("normalizes duplicated spaces", () => {
    expect(normalizeGuestName("  Maria   Clara  ")).toBe("Maria Clara");
  });

  it("accepts common accented names", () => {
    expect(guestNameSchema.parse(" Rogério D'Ávila ")).toBe("Rogério D'Ávila");
  });

  it("rejects numeric-only names", () => {
    expect(() => guestNameSchema.parse("12345")).toThrow();
  });
});

describe("image file validation", () => {
  it("accepts supported images up to 25 MB", () => {
    expect(
      validateImageFileInput({
        name: "foto.jpg",
        type: "image/jpeg",
        size: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("accepts gallery images with missing mime type when the extension is supported", () => {
    expect(
      validateImageFileInput({
        name: "foto.heic",
        type: "",
        size: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects unsupported mime types", () => {
    expect(
      validateImageFileInput({
        name: "foto.pdf",
        type: "application/pdf",
        size: 1024,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_FILE_TYPE" });
  });

  it("rejects files over 25 MB", () => {
    expect(
      validateImageFileInput({
        name: "foto.png",
        type: "image/png",
        size: 26 * 1024 * 1024,
      }),
    ).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });
});

describe("video file validation", () => {
  it("accepts supported videos up to 100 MB and 60 seconds", () => {
    expect(
      validateVideoFileInput({
        name: "cerimonia.mp4",
        type: "video/mp4",
        size: 100 * 1024 * 1024,
        durationSeconds: 60,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects unsupported video types", () => {
    expect(
      validateVideoFileInput({
        name: "cerimonia.avi",
        type: "video/x-msvideo",
        size: 1024,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_VIDEO_TYPE" });
  });

  it("rejects videos larger than 100 MB", () => {
    expect(
      validateVideoFileInput({
        name: "cerimonia.mp4",
        type: "video/mp4",
        size: 101 * 1024 * 1024,
      }),
    ).toMatchObject({ ok: false, code: "VIDEO_TOO_LARGE" });
  });

  it("rejects videos longer than 60 seconds when duration is available", () => {
    expect(
      validateVideoFileInput({
        name: "cerimonia.mp4",
        type: "video/mp4",
        size: 1024,
        durationSeconds: 61,
      }),
    ).toMatchObject({ ok: false, code: "VIDEO_TOO_LONG" });
  });
});

describe("client validation", () => {
  it("normalizes internal client numbers", () => {
    expect(clientNumberSchema.parse(" cli 001 ")).toBe("CLI-001");
  });

  it("rejects unsafe internal client numbers", () => {
    expect(() => clientNumberSchema.parse("cliente/001")).toThrow();
  });
});
