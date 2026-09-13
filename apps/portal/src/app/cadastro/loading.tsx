import styles from "./loading.module.css";

export default function SignupLoading() {
  return (
    <main className={styles.page} aria-label="Carregando cadastro" aria-busy="true">
      <section className={styles.card}>
        <span className={styles.logo} />
        <span className={styles.title} />
        <span className={styles.copy} />
        <span className={styles.field} />
        <span className={styles.field} />
        <span className={styles.action} />
      </section>
    </main>
  );
}
