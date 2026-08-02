import { describe, expect, it } from "vitest";
import { validateBunnyStorageEnv, validateServerEnv } from "@/lib/env";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@db:5432/app?schema=public",
  APP_BASE_URL: "https://casamento.example.com",
  ADMIN_API_KEY: "admin-key",
  CLIENT_HASH_SECRET: "client-secret",
  BUNNY_STORAGE_ENDPOINT: "https://br.storage.bunnycdn.com/app-casamento/",
  BUNNY_STORAGE_PASSWORD: "storage-secret",
  BUNNY_PUBLIC_BASE_URL: "https://cdn.example.com/",
  APP_PORT: "3010",
};

describe("environment validation", () => {
  it("normalizes valid production values without exposing secrets", () => {
    expect(validateServerEnv(validEnv, { isProduction: true })).toMatchObject({
      APP_BASE_URL: "https://casamento.example.com",
      BUNNY_STORAGE_ENDPOINT: "https://br.storage.bunnycdn.com/app-casamento",
      BUNNY_PUBLIC_BASE_URL: "https://cdn.example.com",
      APP_PORT: 3010,
    });
  });

  it("rejects invalid Bunny endpoint URLs", () => {
    expect(() =>
      validateBunnyStorageEnv(
        {
          ...validEnv,
          BUNNY_STORAGE_ENDPOINT: "not a url",
        },
        { isProduction: true },
      ),
    ).toThrow(/BUNNY_STORAGE_ENDPOINT/);
  });

  it("rejects a missing Bunny password without printing other values", () => {
    expect(() =>
      validateBunnyStorageEnv(
        {
          ...validEnv,
          BUNNY_STORAGE_PASSWORD: "",
        },
        { isProduction: true },
      ),
    ).toThrow(/BUNNY_STORAGE_PASSWORD/);
  });

  it("rejects public CDN URL equal to the private storage endpoint", () => {
    expect(() =>
      validateBunnyStorageEnv(
        {
          ...validEnv,
          BUNNY_PUBLIC_BASE_URL: validEnv.BUNNY_STORAGE_ENDPOINT,
        },
        { isProduction: true },
      ),
    ).toThrow(/diferente/);
  });
});
