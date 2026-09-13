import Link from "next/link";
import { LoginIcon } from "@/features/auth/components/login-icons";
import styles from "./onboarding.module.css";
import { EventIcon } from "@/features/events/components/event-icon";

export function AccountReady({ name }: { name: string }) {
  return <>
    <div className={styles.partyIllustration}><EventIcon name="party" /></div>
    <h1 className={styles.title}>Tudo certo,<br />{name}!</h1>
    <p className={styles.lead}>Sua conta no Nosso Álbum<br />está pronta.</p>
    <p className={styles.readyText}>Agora vamos criar o espaço onde<br />seus momentos vão acontecer.</p>
    <Link className={styles.primaryButton} href="/eventos/novo/tipo">Criar meu primeiro evento<LoginIcon name="arrow" /></Link>
    <Link className={styles.skipLink} href="/logou">Explorar meus álbuns</Link>
  </>;
}
