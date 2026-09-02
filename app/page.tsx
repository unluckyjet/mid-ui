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
      <h1 className={`${bowlbyOne.className} ${styles.wordmark}`}>Mid UI</h1>
    </main>
  );
}
