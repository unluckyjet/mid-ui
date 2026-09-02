import localFont from "next/font/local";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "./fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={`${bowlbyOne.className} ${styles.title}`}>Mid UI</h1>
          <span className={styles.divider} aria-hidden="true" />
          <p className={styles.description}>UI components, built from scratch.</p>
        </div>
      </header>
    </main>
  );
}
