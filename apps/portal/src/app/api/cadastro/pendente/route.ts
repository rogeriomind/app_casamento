import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { setPendingSignup, clearPendingSignup } from "@/lib/pending-signup";
import { apiResponse, HttpError } from "@/lib/api";

// Resume an unconfirmed account only with its original password.
export function POST(request: Request) {
  return apiResponse(request, async () => {
    const body = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8).max(128) }).parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { accounts: { where: { providerId: "credential" } } } });
    const hash = user?.accounts[0]?.password;
    if (!user || user.emailVerified || !hash || !await verifyPassword({ hash, password: body.password })) {
      throw new HttpError(401, "E-mail ou senha inválidos.");
    }
    await auth.api.sendVerificationOTP({ body: { email: user.email, type: "email-verification" } });
    await setPendingSignup(user.id);
    return NextResponse.json({ email: user.email });
  });
}
export function DELETE(request: Request) {
  return apiResponse(request, async () => { await clearPendingSignup(); return NextResponse.json({ ok: true }); });
}
