import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import { PathMarqueeDemo } from "./path-marquee-demo";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function PathMarqueePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`${bowlbyOne.className} ${styles.brand}`} href="/">
          Mid UI
        </Link>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Text animation · 001</p>
        <h1>Path Marquee</h1>
        <p className={styles.description}>
          A seamless phrase band drawn along original SVG contours. Hover or
          focus the specimen to hold it in place.
        </p>
      </section>

      <section className={styles.specimen} aria-label="Path Marquee specimen">
        <PathMarqueeDemo />
      </section>
    </main>
  );
}
