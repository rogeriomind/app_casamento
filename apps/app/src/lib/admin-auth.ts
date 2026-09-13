import { jsonError } from "@/lib/api";

export function getAdminApiKey() {
  return process.env.ADMIN_API_KEY?.trim() ?? "";
}

export function isAuthorizedAdminRequest(request: Request) {
  const adminApiKey = getAdminApiKey();

  if (!adminApiKey) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${adminApiKey}`;
}

export function requireAdminRequest(request: Request) {
  if (isAuthorizedAdminRequest(request)) {
    return null;
  }

  return jsonError("Nao autorizado.", 401, "UNAUTHORIZED");
}
