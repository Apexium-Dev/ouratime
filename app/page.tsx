import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.hero}>
      <div className={styles.heroInner}>
        <h1 className={styles.headline}>
          Track time.<br />Work smarter.
        </h1>
        <p className={styles.subline}>
          Free, open-source time tracking for teams who value simplicity.<br />
          No paywalls. No clutter. Just the tools you actually use.
        </p>
        <Link href="/signup" className={styles.cta}>
          Start tracking free →
        </Link>
      </div>
    </main>
  );
}
