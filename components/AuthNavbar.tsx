import Link from "next/link";
import styles from "./AuthNavbar.module.css";

export function AuthNavbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="OurATime" height={26} />
        </Link>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          Documentation
        </a>
      </div>
    </nav>
  );
}
