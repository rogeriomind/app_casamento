import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const cookieName = "nosso_album_pending_signup";
const maxAge = 60 * 60 * 24;
const identifier = (token: string) => "pending-signup-" + createHash("sha256").update(token).digest("hex");
const options = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge,
  secure: (process.env.BETTER_AUTH_URL ?? "").startsWith("https:") };

// Only issued after password-authenticated registration or recovery.
export async function setPendingSignup(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.verification.create({ data: { id: randomUUID(), identifier: identifier(token),
    value: userId, expiresAt: new Date(Date.now() + maxAge * 1000) } });
  (await cookies()).set(cookieName, token, options);
}

export async function getPendingSignup() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const pending = await prisma.verification.findFirst({ where: { identifier: identifier(token), expiresAt: { gt: new Date() } } });
  if (!pending) return null;
  const user = await prisma.user.findUnique({ where: { id: pending.value } });
  return user && !user.emailVerified ? user : null;
}

export async function getPendingSignupEmail() {
  return (await getPendingSignup())?.email ?? null;
}

export async function clearPendingSignup() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await prisma.verification.deleteMany({ where: { identifier: identifier(token) } });
  jar.set(cookieName, "", { ...options, maxAge: 0 });
}
