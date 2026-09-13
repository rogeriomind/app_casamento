import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type MediaGrant = { e: string; p: string; x: number };

const grantLifetimeSeconds = 30 * 60;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET não configurado.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createMediaGrant(eventId: string, photoId: string, now = Date.now()) {
  const claims: MediaGrant = { e: eventId, p: photoId, x: Math.floor(now / 1000) + grantLifetimeSeconds };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyMediaGrant(token: string | null, eventId: string, photoId: string, now = Date.now()) {
  if (!token || token.length > 1024) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<MediaGrant>;
    return claims.e === eventId && claims.p === photoId && Number.isInteger(claims.x) && claims.x! >= Math.floor(now / 1000);
  } catch {
    return false;
  }
}
