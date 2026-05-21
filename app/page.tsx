import Link from "next/link";
import styles from "./page.module.css";

const features = [
  {
    title: "Distraction-Free Timer",
    description:
      "A clean start/stop timer with description, project, and tags. No badges, no pings — just you and your work.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: "Powerful Analytics",
    description:
      "Visual charts and weekly reports broken down by project, task, and tag. Know exactly where your time goes.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    title: "Open Source & Free",
    description:
      "Built for the community. Self-host it, fork it, extend it. No paywalls — every feature is free, forever.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <h1 className={styles.headline}>
              Master your focus.<br />Reclaim your time.
            </h1>
            <p className={styles.subline}>
              The free, open-source time tracker for teams who value simplicity.
              No paywalls. No clutter. Just the tools you actually use.
            </p>
            <Link href="/signup" className={styles.cta}>
              Get started free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.featuresSection} id="features">
        <div className={styles.featuresGrid}>
          {features.map(({ title, description, icon }) => (
            <div key={title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{icon}</div>
              <h3 className={styles.featureTitle}>{title}</h3>
              <p className={styles.featureDesc}>{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Method ── */}
      <section className={styles.methodSection} id="method">
        <div className={styles.methodInner}>
          <span className={styles.methodLabel}>The Method</span>
          <h2 className={styles.methodHeadline}>Built for real work, not enterprise demos</h2>
          <div className={styles.quote}>
            <p className={styles.quoteText}>
              &ldquo;True progress requires more than just &lsquo;spending time.&rsquo; It requires a
              sharp distinction between{" "}
              <strong>managing tasks</strong> and{" "}
              <strong>doing deep work</strong>.&rdquo;
            </p>
            <p className={styles.quoteBody}>
              OurATime was built by daily Clockify users who were tired of paying for features
              that should be free — and fighting through UI that gets in the way of the work itself.
              Simple, open, and yours to own.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerDots} aria-hidden="true" />
        <div className={styles.footerInner}>
          <h2 className={styles.footerHeadline}>Ready to start tracking?</h2>
          <Link href="/signup" className={styles.footerCta}>Go to App</Link>
          <p className={styles.footerVersion}>v0.1.0 · Open Source · Free forever</p>
          <div className={styles.footerBottom}>
            <div>
              <p className={styles.footerBrand}>ouratime</p>
              <p className={styles.footerCopy}>© 2025 OurATime. All rights reserved.</p>
            </div>
            <div className={styles.footerLinks}>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <Link href="/contact">Contact</Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
