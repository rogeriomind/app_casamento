import { z } from "zod";

type RuntimeEnv = Record<string, string | undefined>;

export type ServerEnv = {
  DATABASE_URL: string;
  APP_BASE_URL: string;
  ADMIN_API_KEY: string;
  CLIENT_HASH_SECRET: string;
  BUNNY_STORAGE_ENDPOINT: string;
  BUNNY_STORAGE_PASSWORD: string;
  BUNNY_PUBLIC_BASE_URL: string;
  BUNNY_STREAM_LIBRARY_ID: string;
  BUNNY_STREAM_API_KEY: string;
  BUNNY_STREAM_PULL_ZONE_HOSTNAME: string;
  BUNNY_STREAM_WEBHOOK_SECRET: string;
  APP_PORT?: number;
};

const rawServerEnvSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL nao definido."),
  APP_BASE_URL: z.string().trim().min(1, "APP_BASE_URL nao definido."),
  ADMIN_API_KEY: z.string().trim().min(1, "ADMIN_API_KEY nao definido."),
  CLIENT_HASH_SECRET: z
    .string()
    .trim()
    .min(1, "CLIENT_HASH_SECRET nao definido."),
  BUNNY_STORAGE_ENDPOINT: z
    .string()
    .trim()
    .min(1, "BUNNY_STORAGE_ENDPOINT nao definido."),
  BUNNY_STORAGE_PASSWORD: z
    .string()
    .trim()
    .min(1, "BUNNY_STORAGE_PASSWORD nao definido."),
  BUNNY_PUBLIC_BASE_URL: z
    .string()
    .trim()
    .min(1, "BUNNY_PUBLIC_BASE_URL nao definido."),
  BUNNY_STREAM_LIBRARY_ID: z
    .string()
    .trim()
    .min(1, "BUNNY_STREAM_LIBRARY_ID nao definido."),
  BUNNY_STREAM_API_KEY: z
    .string()
    .trim()
    .min(1, "BUNNY_STREAM_API_KEY nao definido."),
  BUNNY_STREAM_PULL_ZONE_HOSTNAME: z
    .string()
    .trim()
    .min(1, "BUNNY_STREAM_PULL_ZONE_HOSTNAME nao definido."),
  BUNNY_STREAM_WEBHOOK_SECRET: z
    .string()
    .trim()
    .min(1, "BUNNY_STREAM_WEBHOOK_SECRET nao definido."),
  APP_PORT: z.string().trim().optional(),
});

const rawBunnyEnvSchema = rawServerEnvSchema.pick({
  BUNNY_STORAGE_ENDPOINT: true,
  BUNNY_STORAGE_PASSWORD: true,
  BUNNY_PUBLIC_BASE_URL: true,
});

const rawBunnyStreamEnvSchema = rawServerEnvSchema.pick({
  BUNNY_STREAM_LIBRARY_ID: true,
  BUNNY_STREAM_API_KEY: true,
  BUNNY_STREAM_PULL_ZONE_HOSTNAME: true,
  BUNNY_STREAM_WEBHOOK_SECRET: true,
});

function normalizeBaseUrl(name: string, value: string, requireHttps: boolean) {
  const trimmed = value.trim();

  if (/\s/.test(trimmed)) {
    throw new Error(`${name} nao pode conter espacos.`);
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(withoutTrailingSlash);
  } catch {
    throw new Error(`${name} deve ser uma URL valida.`);
  }

  if (requireHttps && parsed.protocol !== "https:") {
    throw new Error(`${name} deve usar HTTPS em producao.`);
  }

  return withoutTrailingSlash;
}

function normalizeDatabaseUrl(value: string) {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error("DATABASE_URL deve ser uma URL PostgreSQL valida.");
  }

  return trimmed;
}

function normalizeAppPort(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("APP_PORT deve ser numerico.");
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("APP_PORT deve estar entre 1 e 65535.");
  }

  return port;
}

function normalizeStreamLibraryId(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("BUNNY_STREAM_LIBRARY_ID deve ser numerico.");
  }

  return trimmed;
}

function normalizeHostname(name: string, value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/\s/.test(trimmed)) {
    throw new Error(`${name} nao pode conter espacos.`);
  }

  try {
    const parsed = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    if (!parsed.hostname || parsed.pathname !== "/") {
      throw new Error();
    }

    return parsed.hostname;
  } catch {
    throw new Error(`${name} deve ser um hostname valido.`);
  }
}

function formatEnvError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Configuracao de ambiente invalida.";
}

export function validateServerEnv(
  rawEnv: RuntimeEnv = process.env,
  options: { isProduction?: boolean } = {},
): ServerEnv {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";

  try {
    const raw = rawServerEnvSchema.parse(rawEnv);
    const databaseUrl = normalizeDatabaseUrl(raw.DATABASE_URL);
    const appBaseUrl = normalizeBaseUrl("APP_BASE_URL", raw.APP_BASE_URL, isProduction);
    const storageEndpoint = normalizeBaseUrl(
      "BUNNY_STORAGE_ENDPOINT",
      raw.BUNNY_STORAGE_ENDPOINT,
      isProduction,
    );
    const publicBaseUrl = normalizeBaseUrl(
      "BUNNY_PUBLIC_BASE_URL",
      raw.BUNNY_PUBLIC_BASE_URL,
      isProduction,
    );

    if (storageEndpoint === publicBaseUrl) {
      throw new Error(
        "BUNNY_PUBLIC_BASE_URL deve ser diferente do endpoint privado do Storage.",
      );
    }

    return {
      DATABASE_URL: databaseUrl,
      APP_BASE_URL: appBaseUrl,
      ADMIN_API_KEY: raw.ADMIN_API_KEY.trim(),
      CLIENT_HASH_SECRET: raw.CLIENT_HASH_SECRET.trim(),
      BUNNY_STORAGE_ENDPOINT: storageEndpoint,
      BUNNY_STORAGE_PASSWORD: raw.BUNNY_STORAGE_PASSWORD.trim(),
      BUNNY_PUBLIC_BASE_URL: publicBaseUrl,
      BUNNY_STREAM_LIBRARY_ID: normalizeStreamLibraryId(
        raw.BUNNY_STREAM_LIBRARY_ID,
      ),
      BUNNY_STREAM_API_KEY: raw.BUNNY_STREAM_API_KEY.trim(),
      BUNNY_STREAM_PULL_ZONE_HOSTNAME: normalizeHostname(
        "BUNNY_STREAM_PULL_ZONE_HOSTNAME",
        raw.BUNNY_STREAM_PULL_ZONE_HOSTNAME,
      ),
      BUNNY_STREAM_WEBHOOK_SECRET: raw.BUNNY_STREAM_WEBHOOK_SECRET.trim(),
      APP_PORT: normalizeAppPort(raw.APP_PORT),
    };
  } catch (error) {
    throw new Error(`Ambiente invalido: ${formatEnvError(error)}`);
  }
}

export function validateBunnyStreamEnv(rawEnv: RuntimeEnv = process.env) {
  try {
    const raw = rawBunnyStreamEnvSchema.parse(rawEnv);

    return {
      libraryId: normalizeStreamLibraryId(raw.BUNNY_STREAM_LIBRARY_ID),
      apiKey: raw.BUNNY_STREAM_API_KEY.trim(),
      pullZoneHostname: normalizeHostname(
        "BUNNY_STREAM_PULL_ZONE_HOSTNAME",
        raw.BUNNY_STREAM_PULL_ZONE_HOSTNAME,
      ),
      webhookSecret: raw.BUNNY_STREAM_WEBHOOK_SECRET.trim(),
    };
  } catch (error) {
    throw new Error(`Ambiente Bunny Stream invalido: ${formatEnvError(error)}`);
  }
}

export function validateBunnyStorageEnv(
  rawEnv: RuntimeEnv = process.env,
  options: { isProduction?: boolean } = {},
) {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";

  try {
    const raw = rawBunnyEnvSchema.parse(rawEnv);
    const storageEndpoint = normalizeBaseUrl(
      "BUNNY_STORAGE_ENDPOINT",
      raw.BUNNY_STORAGE_ENDPOINT,
      isProduction,
    );
    const publicBaseUrl = normalizeBaseUrl(
      "BUNNY_PUBLIC_BASE_URL",
      raw.BUNNY_PUBLIC_BASE_URL,
      isProduction,
    );

    if (storageEndpoint === publicBaseUrl) {
      throw new Error(
        "BUNNY_PUBLIC_BASE_URL deve ser diferente do endpoint privado do Storage.",
      );
    }

    return {
      storageEndpoint,
      storagePassword: raw.BUNNY_STORAGE_PASSWORD.trim(),
      publicBaseUrl,
    };
  } catch (error) {
    throw new Error(`Ambiente Bunny invalido: ${formatEnvError(error)}`);
  }
}

export function getBunnyEnv() {
  const env = validateBunnyStorageEnv();
  return {
    storageEndpoint: env.storageEndpoint,
    publicBaseUrl: env.publicBaseUrl,
  };
}

export function getServerEnv() {
  return validateServerEnv();
}
