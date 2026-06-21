import { createHmac } from "node:crypto";
import {
  normalizeClientName,
  normalizeClientNumber,
} from "@/lib/client-normalization";

export const CLIENT_HASH_LENGTH = 20;
export { normalizeClientName, normalizeClientNumber };

export function getClientHashSecret() {
  const secret = process.env.CLIENT_HASH_SECRET?.trim();

  if (!secret) {
    throw new Error("CLIENT_HASH_SECRET nao esta configurado.");
  }

  return secret;
}

export function createClientHash(
  clientName: string,
  clientNumber: string,
  secret = getClientHashSecret(),
) {
  const normalizedClientName = normalizeClientName(clientName);
  const normalizedClientNumber = normalizeClientNumber(clientNumber);

  return createHmac("sha256", secret)
    .update(`${normalizedClientName}:${normalizedClientNumber}`)
    .digest("hex")
    .slice(0, CLIENT_HASH_LENGTH);
}

export function createClientStoragePrefix(clientHash: string) {
  return `clients/${clientHash}`;
}

export function getAppBaseUrl() {
  return (process.env.APP_BASE_URL?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export function buildClientPublicUrl(clientHash: string) {
  return `${getAppBaseUrl()}/e/${clientHash}`;
}

export function buildClientMetricsUrl(clientHash: string) {
  return `${getAppBaseUrl()}/api/admin/clients/${clientHash}/metrics`;
}
