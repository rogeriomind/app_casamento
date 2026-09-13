import styles from "./loading.module.css";

export default function EventWizardLoading() {
  return (
    <main className={styles.page} aria-label="Carregando criação do álbum" aria-busy="true">
      <header><span /><span /></header>
      <section>
        <span className={styles.title} />
        <span className={styles.copy} />
        <div className={styles.cards}>{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
      </section>
    </main>
  );
}
