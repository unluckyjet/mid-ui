import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import { ConstellationTypeDemo } from "./constellation-type-demo";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function ConstellationTypePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`${bowlbyOne.className} ${styles.brand}`} href="/">
          Mid UI
        </Link>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Text field · 003</p>
        <h1>Constellation Type</h1>
        <p className={styles.description}>
          A headline mapped as a living star chart. Points gather into glyphs,
          idle in place, and open a soft clearing around the pointer.
        </p>
      </section>

      <section className={styles.specimen} aria-label="Constellation Type specimen">
        <ConstellationTypeDemo displayClassName={bowlbyOne.className} />
      </section>
    </main>
  );
}
