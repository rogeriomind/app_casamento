import Link from "next/link";
import { EditorialPanel } from "@/features/auth/components/editorial-panel";
import { Brand } from "@/features/auth/components/brand";
import { LoginIcon } from "@/features/auth/components/login-icons";
import styles from "./onboarding.module.css";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <EditorialPanel variant="signup" />
      <section className={styles.panel}>
        <Link href="/" aria-label="Voltar para o site" className={styles.backLink}><LoginIcon name="arrow" /><span>Voltar para o site</span><LoginIcon name="external" /></Link>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}

export function OnboardingBrand() {
  return <div className={styles.brandWrap}><Brand /></div>;
}
