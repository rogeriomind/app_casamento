import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export const getCurrentSession = cache(async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireVerifiedUser() {
  const session = await getCurrentSession();

  if (!session?.user) redirect("/login");
  if (!session.user.emailVerified) redirect("/cadastro/confirmar-email");

  return session.user;
}
