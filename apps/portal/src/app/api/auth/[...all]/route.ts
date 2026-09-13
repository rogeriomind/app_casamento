import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { getPendingSignupEmail } from "@/lib/pending-signup";

const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/email-otp/verify-email") || path.endsWith("/email-otp/send-verification-otp")) {
    const pending = await getPendingSignupEmail();
    const body = await request.clone().json().catch(() => null);
    if (!pending || body?.email?.toLowerCase() !== pending || (body.type && body.type !== "email-verification")) {
      return Response.json({ message: "Cadastro pendente não encontrado." }, { status: 403 });
    }
  }
  if (path.includes("/sign-in/email-otp") || path.includes("password-reset") || path.includes("reset-password") || path.includes("email-change")) {
    return Response.json({ message: "Recurso ainda indisponível." }, { status: 404 });
  }
  return handlers.POST(request);
}
