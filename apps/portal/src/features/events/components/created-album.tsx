import Link from "next/link";
import { Brand } from "@/features/auth/components/brand";
import { LoginIcon } from "@/features/auth/components/login-icons";
import { EventIcon } from "./event-icon";
import styles from "./event-wizard.module.css";
export function CreatedAlbum({ event }: { event: { id: string; name: string | null; albumColor: string; coverPath: string | null } }) {
  const cover = event.coverPath ? "/api/eventos/" + event.id + "/capa" : "/images/login/party.lossless.webp";
  return <main className={styles.created}><Brand />
    <section className={styles.createdContent}>
      <div className={styles.createdText}><div className={styles.check}><EventIcon name="check" /></div>
        <h1>Seu momento<br />já tem um lugar.</h1><h2>{event.name}</h2>
        <p>Agora é só convidar as pessoas e começar<br />a receber as fotos.</p>
      </div>
      <div className={styles.albumCard} style={{ backgroundColor: event.albumColor }}>
        <img src={cover} alt={"Capa de " + event.name} /><div><b>{event.name}</b><span><LoginIcon name="camera" />0 fotos</span></div>
      </div>
    </section>
    <footer className={styles.createdFooter}>
      <Link className={styles.secondary} href={`/eventos/${event.id}`}>Ir para meu álbum</Link>
      <p className={styles.shareNotice}><EventIcon name="sparkle" /> Convites e envio de fotos serão liberados em breve. Enquanto isso, seu álbum já está pronto para você.</p>
      <p className={styles.handNote}>Juntos<br />em cada<br />momento ♡</p>
    </footer>
  </main>;
}
