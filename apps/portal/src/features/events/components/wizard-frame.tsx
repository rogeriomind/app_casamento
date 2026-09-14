import { Brand } from "@/features/auth/components/brand";
import styles from "./event-wizard.module.css";
export function WizardFrame({ step, children }: { step: 1 | 2 | 3; children: React.ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.header}><Brand /><div className={styles.progress} aria-label={`Etapa ${step} de 3`}><span><i style={{ width: `${step / 3 * 100}%` }} /></span><b>{step} de 3</b></div></header>
    {children}
  </main>;
}
