import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./http-error";
import { getCurrentSession } from "./session";

export { HttpError } from "./http-error";
export async function apiUser() {
  const session = await getCurrentSession();
  if (!session?.user) throw new HttpError(401, "Sua sessão expirou. Entre novamente.");
  if (!session.user.emailVerified) throw new HttpError(403, "Confirme seu e-mail antes de continuar.");
  return session.user;
}
export async function apiResponse(request: Request, action: () => Promise<Response>) {
  try {
    const origin = request.headers.get("origin");
    const allowedOrigins = [new URL(process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000").origin, "http://localhost:3000", "http://127.0.0.1:3000"];
    if (request.method !== "GET" && origin && !allowedOrigins.includes(origin)) {
      throw new HttpError(403, "Origem da solicitação inválida.");
    }
    return await action();
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });
    }
    console.error("Falha na operação:", error instanceof Error ? error.message : "Erro desconhecido");
    return NextResponse.json({ error: "Não foi possível concluir. Tente novamente." }, { status: 500 });
  }
}
