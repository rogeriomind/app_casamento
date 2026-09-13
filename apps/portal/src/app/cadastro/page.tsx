import type { Metadata } from "next";
import { OnboardingBrand, OnboardingShell } from "@/features/onboarding/components/onboarding-shell";
import { SignupForm } from "@/features/onboarding/components/signup-form";
import styles from "@/features/onboarding/components/onboarding.module.css";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Criar conta | Nosso Álbum" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ "nova-conta"?: string | string[] }>;
}) {
  const { "nova-conta": newAccount } = await searchParams;
  const isStartingNewAccount = newAccount === "1";

  if (!isStartingNewAccount && (await getCurrentSession())?.user.emailVerified) {
    redirect("/cadastro/concluido");
  }
  return <OnboardingShell><OnboardingBrand /><h1 className={styles.title}>Comece sua<br />história.</h1><p className={styles.lead}>Crie sua conta e transforme seus momentos em histórias para guardar e compartilhar.</p><SignupForm /></OnboardingShell>;
}
