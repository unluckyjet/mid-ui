import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import { SceneTypeDemo } from "./scene-type-demo";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function SceneTypePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`${bowlbyOne.className} ${styles.brand}`} href="/">
          Mid UI
        </Link>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Text composition · 002</p>
        <h1>Scene Type</h1>
        <p className={styles.description}>
          An editorial heading that turns each glyph into a moving viewfinder.
          The frame stays precise while the scene drifts behind the type.
        </p>
      </section>

      <section className={styles.specimen} aria-label="Scene Type specimen">
        <SceneTypeDemo />
      </section>
    </main>
  );
}
