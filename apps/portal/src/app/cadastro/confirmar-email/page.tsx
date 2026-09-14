import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getPendingSignupEmail } from "@/lib/pending-signup";
import { prisma } from "@/lib/prisma";
import { OnboardingShell } from "@/features/onboarding/components/onboarding-shell";
import { VerificationForm } from "@/features/onboarding/components/verification-form";

export default async function ConfirmEmailPage() {
  const session = await getCurrentSession();
  if (session?.user?.emailVerified) redirect("/cadastro/concluido");
  const email = session?.user?.email ?? await getPendingSignupEmail();
  if (!email) redirect("/cadastro");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) redirect("/cadastro");
  return <OnboardingShell><VerificationForm initialEmail={email} /></OnboardingShell>;
}
