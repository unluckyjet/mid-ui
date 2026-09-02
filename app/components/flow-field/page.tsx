import localFont from "next/font/local";
import { FlowField } from "../../../components/flow-field";
import { ThemeToggle } from "../../../components/theme-toggle/theme-toggle";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "../../fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function FlowFieldPreview() {
  return (
    <main className={styles.page}>
      <FlowField />
      <header className={styles.header}>
        <p className={`${bowlbyOne.className} ${styles.brand}`}>Mid UI</p>
        <ThemeToggle />
      </header>
      <section className={styles.copy}>
        <p className={styles.eyebrow}>Background / 02</p>
        <h1 className={styles.title}>Flow Field</h1>
        <p className={styles.description}>
          Calm currents drawn from a living field of lines.
        </p>
      </section>
    </main>
  );
}
