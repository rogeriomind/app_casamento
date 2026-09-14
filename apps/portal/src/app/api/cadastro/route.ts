import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setPendingSignup } from "@/lib/pending-signup";
import { apiResponse, HttpError } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120),
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128),
});
export function POST(request: Request) {
  return apiResponse(request, async () => {
    const body = schema.parse(await request.json());
    if (await prisma.user.findUnique({ where: { email: body.email } })) {
      throw new HttpError(409, "Este e-mail já está em uso. Entre para continuar.");
    }
    const result = await auth.api.signUpEmail({ body, headers: request.headers });
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Better Auth may return a synthetic user for a concurrent duplicate signup.
    if (!user || user.id !== result.user.id) throw new HttpError(409, "Este e-mail já está em uso.");
    await setPendingSignup(user.id);
    return NextResponse.json({ email: user.email }, { status: 201 });
  });
}
