import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import { InkTraceDemo } from "./ink-trace-demo";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function InkTracePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`${bowlbyOne.className} ${styles.brand}`} href="/">
          Mid UI
        </Link>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Print room · study 006</p>
        <div className={styles.introGrid}>
          <h1>Ink Trace</h1>
          <p className={styles.description}>
            A dry outline crosses the sheet first. The color arrives later,
            gathering upward like fresh ink pulled from a hand-set plate.
          </p>
        </div>
      </section>

      <section className={styles.specimen} aria-label="Ink Trace specimen">
        <InkTraceDemo displayClassName={bowlbyOne.className} />
      </section>
    </main>
  );
}
