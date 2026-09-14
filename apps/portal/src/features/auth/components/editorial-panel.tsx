import { Brand } from "./brand";
import { LoginIcon } from "./login-icons";
import styles from "./login.module.css";

const benefits = [
  { icon: "camera", first: "Compartilhe", second: "fotos e vídeos" },
  { icon: "people", first: "Conecte", second: "convidados" },
  { icon: "image", first: "Reviva", second: "momentos" },
  { icon: "heart", first: "Para todos", second: "os tipos de eventos" },
] as const;

export function EditorialPanel({ variant = "login" }: { variant?: "login" | "signup" }) {
  return (
    <aside className={`${styles.editorial} ${variant === "signup" ? styles.signupEditorial : ""}`} aria-label="Todo momento importa. Registre junto.">
      <div className={styles.editorialCanvas}>
        <div className={styles.editorialBrand}><Brand /></div>
        <div className={styles.eyebrow}><span />EVENTOS QUE CONECTAM</div>
        <h2 className={styles.headline}>
          <span>TODO</span><span>MOMENTO</span><span>IMPORTA.</span>
          <span className={styles.outline}>REGISTRE</span><span className={styles.outline}>JUNTO<span className={styles.outlinePeriod}>.</span></span>
        </h2>
        <p className={styles.description}>
          Reúna as fotos dos seus eventos<br />
          em um só lugar e transforme cada<br />
          momento em uma história inesquecível.
        </p>

        <div className={styles.photos} aria-hidden="true">
          <svg className={styles.photoRays} viewBox="0 0 60 90" fill="none"><path d="m32 5 17 31M8 38l26 12M4 82l30-13" /></svg>
          <div className={`${styles.polaroid} ${styles.dinnerPhoto}`} />
          <div className={`${styles.polaroid} ${styles.partyPhoto}`} />
          <div className={`${styles.polaroid} ${styles.phonePhoto}`} />
          <div className={styles.limeNote}><span>Grandes<br />histórias<br />são feitas<br />de pessoas<br />reais.</span></div>
          <div className={styles.handwrittenNote}>Juntos<br /><span>em cada</span><br /><span>momento</span>
            <svg viewBox="0 0 90 25" fill="none"><path d="M6 22 77 3M16 21 85 5" /></svg>
          </div>
          <svg className={styles.sketchHeart} viewBox="0 0 32 44" fill="none"><path d="M14 37C8 27 2 17 6 10c4-6 9-2 10 6 4-17 13-15 12-6-1 9-9 20-14 27Z" /></svg>
        </div>

        <ul className={styles.benefits}>
          {benefits.map((benefit) => <li key={benefit.icon}>
            <span className={styles.benefitIcon}><LoginIcon name={benefit.icon} /></span>
            <span>{benefit.first}<br />{benefit.second}</span>
          </li>)}
        </ul>
        <p className={styles.eventTypes}>CASAMENTOS, ANIVERSÁRIOS,<br />FORMATURAS, EVENTOS CORPORATIVOS<br />E MUITO MAIS.</p>
      </div>
    </aside>
  );
}
