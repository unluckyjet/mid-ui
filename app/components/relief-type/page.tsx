import Link from "next/link";
import { ReliefTypeDemo } from "./relief-type-demo";
import styles from "./page.module.css";

export default function ReliefTypePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>Mid UI</Link>
        <span>Text specimen / 010</span>
      </header>
      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>ReliefType</p>
          <h1>Type with<br />a cut edge.</h1>
        </div>
        <p className={styles.copy}>
          A bounded stack of offset faces builds depth without a shader. Move across the proof to tilt the plate; leave it alone and it resumes a slow orbit.
        </p>
      </section>
      <ReliefTypeDemo />
    </main>
  );
}
