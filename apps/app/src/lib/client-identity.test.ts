import { afterEach, describe, expect, it } from "vitest";
import {
  CLIENT_HASH_LENGTH,
  buildClientMetricsUrl,
  buildClientPublicUrl,
  createClientHash,
  createClientStoragePrefix,
  normalizeClientName,
  normalizeClientNumber,
} from "@/lib/client-identity";

describe("client identity helpers", () => {
  afterEach(() => {
    delete process.env.APP_BASE_URL;
  });

  it("normalizes client fields", () => {
    expect(normalizeClientName("  Cliente   XPTO  ")).toBe("Cliente XPTO");
    expect(normalizeClientNumber(" cli 001 ")).toBe("CLI-001");
  });

  it("creates deterministic short client hashes", () => {
    const hash = createClientHash("Cliente XPTO", "CLI-001", "secret");

    expect(hash).toHaveLength(CLIENT_HASH_LENGTH);
    expect(createClientHash("Cliente XPTO", "CLI-001", "secret")).toBe(hash);
    expect(createClientHash("Cliente XPTO", "CLI-002", "secret")).not.toBe(hash);
  });

  it("builds public URLs and storage prefixes", () => {
    process.env.APP_BASE_URL = "https://album.example.com/";

    expect(createClientStoragePrefix("abc123")).toBe("clients/abc123");
    expect(buildClientPublicUrl("abc123")).toBe(
      "https://album.example.com/e/abc123",
    );
    expect(buildClientMetricsUrl("abc123")).toBe(
      "https://album.example.com/api/admin/clients/abc123/metrics",
    );
  });
});
