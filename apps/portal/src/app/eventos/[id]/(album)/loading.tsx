import styles from "./loading.module.css";

export default function AlbumPageLoading() {
  return (
    <main className={styles.loading} aria-label="Carregando seção do álbum" aria-busy="true">
      <div className={styles.heading} />
      <div className={styles.subheading} />
      <div className={styles.cards}>
        {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
      </div>
    </main>
  );
}
