import { describe, expect, it } from "vitest";
import { createBunnyTusFingerprint } from "@/lib/video-upload-client";

describe("video upload client", () => {
  it("scopes resumable TUS fingerprints to the Bunny Stream video id", () => {
    const file = new File(["video"], "cerimonia.mp4", {
      type: "video/mp4",
      lastModified: 1800000000000,
    });

    const firstFingerprint = createBunnyTusFingerprint(file, "video-guid-1");
    const secondFingerprint = createBunnyTusFingerprint(file, "video-guid-2");

    expect(firstFingerprint).toContain("video-guid-1");
    expect(secondFingerprint).toContain("video-guid-2");
    expect(firstFingerprint).not.toBe(secondFingerprint);
    expect(createBunnyTusFingerprint(file, "video-guid-1")).toBe(firstFingerprint);
  });
});
