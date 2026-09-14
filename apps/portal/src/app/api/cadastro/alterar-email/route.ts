import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPendingSignup } from "@/lib/pending-signup";
import { apiResponse, HttpError } from "@/lib/api";

export function PATCH(request: Request) {
  return apiResponse(request, async () => {
    const user = await getPendingSignup();
    if (!user) throw new HttpError(401, "Cadastro expirado. Entre novamente para confirmar seu e-mail.");
    const { email } = z.object({ email: z.string().trim().email("Informe um e-mail válido.").max(255).toLowerCase() }).parse(await request.json());
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) throw new HttpError(409, "Este e-mail já está em uso.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id, emailVerified: false }, data: { email } });
      await tx.verification.deleteMany({ where: { identifier: { in: [
        "email-verification-otp-" + user.email, "email-verification-otp-" + email,
      ] } } });
    });
    await auth.api.sendVerificationOTP({ body: { email, type: "email-verification" } });
    return NextResponse.json({ email });
  });
}
