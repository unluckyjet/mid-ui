import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import { LiquidTypeDemo } from "./liquid-type-demo";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function LiquidTypePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`${bowlbyOne.className} ${styles.brand}`} href="/">
          Mid UI
        </Link>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Optic study · 005</p>
        <div className={styles.introGrid}>
          <h1>Liquid Type</h1>
          <p className={styles.description}>
            A headline observed through a field of slow, uneven lenses. The
            surface drifts on its own and gathers into a small ripple around
            the pointer.
          </p>
        </div>
      </section>

      <section className={styles.specimen} aria-label="Liquid Type specimen">
        <LiquidTypeDemo displayClassName={bowlbyOne.className} />
      </section>
    </main>
  );
}
