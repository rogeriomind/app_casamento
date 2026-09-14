import styles from "./login.module.css";

export function Brand() {
  return (
    <div className={styles.brand} aria-label="Nosso Álbum">
      <svg viewBox="0 0 54 44" fill="none" aria-hidden="true">
        <path d="M26 9C19-1 5 3 3 13c-2 10 8 19 16 26 7-5 15-13 15-22 0-6-3-10-8-11" />
        <path d="M27 9c7-10 21-6 23 4 2 10-8 19-16 26-7-5-15-13-15-22 0-6 3-10 8-11" />
      </svg>
      <span>Nosso Álbum</span>
    </div>
  );
}
