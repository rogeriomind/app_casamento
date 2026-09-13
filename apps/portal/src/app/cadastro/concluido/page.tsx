import { requireVerifiedUser } from "@/lib/session";
import { AccountReady } from "@/features/onboarding/components/account-ready";
import { OnboardingShell } from "@/features/onboarding/components/onboarding-shell";

export default async function SignupCompletePage() {
  const user = await requireVerifiedUser();
  return <OnboardingShell><AccountReady name={user.name.split(" ")[0] || user.name} /></OnboardingShell>;
}
