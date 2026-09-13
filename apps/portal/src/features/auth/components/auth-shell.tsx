import Link from "next/link";
import { Brand } from "./brand";
import { LoginForm } from "./login-form";
import { EditorialPanel } from "./editorial-panel";
import { LoginIcon } from "./login-icons";
import styles from "./login.module.css";

export function AuthShell() {
  return (
    <main className={styles.shell}>
      <EditorialPanel />
      <section className={styles.loginPanel} aria-labelledby="login-title">
        <Link href="/" className={styles.backLink}><LoginIcon name="arrow" /><span>Voltar para o site</span><LoginIcon name="external" /></Link>
        <div className={styles.loginContent}>
          <Brand />
          <div className={styles.welcome}>
            <h1 id="login-title"><span>Bem-vindo</span><span>de volta!</span></h1>
            <svg viewBox="0 0 38 60" fill="none" aria-hidden="true"><path d="m6 34 21-27M12 50l16-11" /></svg>
          </div>
          <p className={styles.subtitle}>Acesse sua conta e continue vivendo<br className={styles.desktopBreak} /> grandes momentos.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
