#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadDotEnvIfPresent() {
  if (!existsSync(".env")) {
    return;
  }

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = valueParts
      .join("=")
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

loadDotEnvIfPresent();

function fail(message, extra = {}) {
  console.error(JSON.stringify({ level: "error", message, ...extra }));
  process.exit(1);
}

function normalizeBaseUrl(name, value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    fail(`${name} nao definido.`);
  }
  if (/\s/.test(trimmed)) {
    fail(`${name} nao pode conter espacos.`);
  }

  const normalized = trimmed.replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    fail(`${name} deve ser uma URL valida.`);
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    fail(`${name} deve usar HTTPS em producao.`);
  }

  return normalized;
}

function normalizeObjectPath(objectPath) {
  const segments = objectPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    fail("Caminho de teste invalido.");
  }

  return segments.map(encodeURIComponent).join("/");
}

function buildUrl(baseUrl, objectPath) {
  return `${baseUrl}/${normalizeObjectPath(objectPath)}`;
}

function classifyResponse(status) {
  if (status === 401) {
    return "Senha da Storage Zone invalida ou ausente.";
  }
  if (status === 403) {
    return "Permissao negada para a Storage Zone.";
  }
  if (status === 404) {
    return "Endpoint, regiao ou Storage Zone inexistente.";
  }
  if (status >= 500) {
    return "Bunny Storage indisponivel ou falha temporaria.";
  }
  return `Bunny Storage retornou status inesperado ${status}.`;
}

const storageEndpoint = normalizeBaseUrl(
  "BUNNY_STORAGE_ENDPOINT",
  process.env.BUNNY_STORAGE_ENDPOINT,
);
const publicBaseUrl = normalizeBaseUrl(
  "BUNNY_PUBLIC_BASE_URL",
  process.env.BUNNY_PUBLIC_BASE_URL,
);
const storagePassword = String(process.env.BUNNY_STORAGE_PASSWORD ?? "").trim();

if (!storagePassword) {
  fail("BUNNY_STORAGE_PASSWORD nao definido.");
}

if (storageEndpoint === publicBaseUrl) {
  fail("BUNNY_PUBLIC_BASE_URL deve ser diferente do endpoint privado do Storage.");
}

const objectPath = `healthchecks/${Date.now()}-${randomUUID()}.txt`;
const body = Buffer.from(`app_casamento bunny healthcheck ${new Date().toISOString()}\n`);
const checksum = createHash("sha256").update(body).digest("hex").toUpperCase();

async function request(method, path) {
  const headers = {
    AccessKey: storagePassword,
    "Content-Type": "text/plain; charset=utf-8",
  };
  if (method === "PUT") {
    headers.Checksum = checksum;
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(buildUrl(storageEndpoint, path), {
        method,
        headers,
        body: method === "PUT" ? new Uint8Array(body) : undefined,
      });

      if (response.status < 500 || attempt === 3) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
  }

  fail("Falha de rede ao acessar Bunny Storage.", {
    reason: lastError instanceof Error ? lastError.message : String(lastError),
  });
}

console.log(JSON.stringify({ level: "info", event: "bunny_check_start", objectPath }));

const putResponse = await request("PUT", objectPath);
if (putResponse.status !== 201) {
  fail(classifyResponse(putResponse.status), {
    event: "bunny_check_upload_failed",
    status: putResponse.status,
  });
}

let readResponse = await request("HEAD", objectPath);
if (!readResponse.ok) {
  readResponse = await request("GET", objectPath);
}

if (!readResponse.ok) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "bunny_check_read_not_supported",
      status: readResponse.status,
      message:
        "Upload autenticado passou, mas HEAD/GET autenticado nao confirmou leitura neste endpoint.",
    }),
  );
}

const deleteResponse = await request("DELETE", objectPath);
if (!deleteResponse.ok) {
  fail(classifyResponse(deleteResponse.status), {
    event: "bunny_check_delete_failed",
    status: deleteResponse.status,
  });
}

const afterDeleteResponse = await request("HEAD", objectPath);
if (afterDeleteResponse.status !== 404) {
  if (afterDeleteResponse.status === 401 || afterDeleteResponse.status === 403) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "bunny_check_delete_verify_not_supported",
        status: afterDeleteResponse.status,
        message:
          "DELETE retornou sucesso, mas o endpoint nao permitiu confirmar ausencia por HEAD.",
      }),
    );
  } else {
    fail("Arquivo de healthcheck ainda existe apos exclusao.", {
      event: "bunny_check_delete_verify_failed",
      status: afterDeleteResponse.status,
    });
  }
}

console.log(JSON.stringify({ level: "info", event: "bunny_check_ok", objectPath }));
