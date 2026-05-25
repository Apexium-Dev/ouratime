import styles from "../legal.module.css";

export const metadata = { title: "Contact — OuraTime" };

export default function Contact() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.label}>Contact</span>
        <h1 className={styles.title}>Get in touch</h1>
        <p className={styles.meta}>We&apos;re a small open-source team. Here&apos;s how to reach us.</p>

        <div className={styles.cards}>
          <a
            href="https://github.com/Apexium-Dev/ouratime/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
          >
            <div className={styles.cardIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
              </svg>
            </div>
            <span className={styles.cardTitle}>GitHub Issues</span>
            <span className={styles.cardDesc}>Report bugs, request features, or ask questions publicly.</span>
            <span className={styles.cardLink}>Open an issue →</span>
          </a>

          <a
            href="https://github.com/Apexium-Dev/ouratime/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
          >
            <div className={styles.cardIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <span className={styles.cardTitle}>Discussions</span>
            <span className={styles.cardDesc}>Share ideas, show what you&apos;ve built, or get help from the community.</span>
            <span className={styles.cardLink}>Join the conversation →</span>
          </a>

          <a
            href="mailto:hello@ouratime.app"
            className={styles.card}
          >
            <div className={styles.cardIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <span className={styles.cardTitle}>Email</span>
            <span className={styles.cardDesc}>For private inquiries, partnerships, or anything you&apos;d rather not post publicly.</span>
            <span className={styles.cardLink}>hello@ouratime.app</span>
          </a>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <h2>Response times</h2>
            <p>
              GitHub issues and discussions are monitored regularly — expect a reply within a few days.
              Email response may take longer as it&apos;s handled manually.
            </p>
          </div>
          <hr className={styles.divider} />
          <div className={styles.section}>
            <h2>Self-hosting support</h2>
            <p>
              Running your own instance? The{" "}
              <a href="https://github.com/Apexium-Dev/ouratime" style={{ color: "#4db8b8" }}>
                README
              </a>{" "}
              covers setup. For anything the docs don&apos;t answer, GitHub Discussions is the best place to ask.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
