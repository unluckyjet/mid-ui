import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import { TickerTilesDemo } from "./ticker-tiles-demo";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function TickerTilesPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`${bowlbyOne.className} ${styles.brand}`} href="/">
          Mid UI
        </Link>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <div className={styles.introIndex} aria-hidden="true">
          04
        </div>
        <div>
          <p className={styles.eyebrow}>Text mechanism · 004</p>
          <h1>Ticker Tiles</h1>
          <p className={styles.description}>
            A phrase cycler built like a small print-room instrument. Paper
            cards turn through deterministic glyphs, then settle long enough
            to read.
          </p>
        </div>
      </section>

      <section className={styles.specimen} aria-label="Ticker Tiles specimen">
        <TickerTilesDemo displayClassName={bowlbyOne.className} />
      </section>
    </main>
  );
}
