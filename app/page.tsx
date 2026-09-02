import localFont from "next/font/local";
import { Background } from "../components/background/background";
import { ThemeToggle } from "../components/theme-toggle/theme-toggle";
import styles from "./page.module.css";

const bowlbyOne = localFont({
  display: "swap",
  src: "./fonts/bowlby-one-latin.woff2",
  style: "normal",
  weight: "400",
});

export default function Home() {
  return (
    <Background>
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={`${bowlbyOne.className} ${styles.title}`}>Mid UI</h1>
          <ThemeToggle />
        </header>
      </main>
    </Background>
  );
}
